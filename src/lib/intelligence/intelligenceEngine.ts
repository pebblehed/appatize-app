// src/lib/intelligence/intelligenceEngine.ts
import "server-only";

/**
 * Stage D.6.x — Engine Call Hardening (structured + deterministic)
 *
 * Why this exists:
 * - We saw OpenAI calls fail after ~3 minutes with:
 *   - "Connection error"
 *   - TypeError: fetch failed
 *   - UND_ERR_SOCKET ("other side closed")
 *
 * What this wrapper does:
 * - Adds an upper bound timeout per attempt (so we don't hang indefinitely).
 * - Retries a small number of times on transient network/socket failures.
 * - Preserves the exact function signature of the internal engine (no drift).
 *
 * Contract:
 * - Never changes the input/output shape.
 * - Only adds resilience around the internal call.
 */

import {
  generateAnglesAndVariantsFromBrief as _generate,
} from "../../../internal/cie/intelligenceEngine";

// Reuse the exact signature from the internal engine so TS stays correct.
type GenerateFn = typeof _generate;

const DEFAULT_TIMEOUT_MS = 90_000; // 90s per attempt
const DEFAULT_MAX_RETRIES = 2; // total attempts = 1 + retries => 3 tries max
const BASE_BACKOFF_MS = 800; // 800ms, 1600ms, 3200ms...

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function isTransientNetworkError(err: unknown): boolean {
  const e = err as any;
  const msg = String(e?.message ?? "").toLowerCase();
  const code = String(e?.code ?? "").toUpperCase();
  const causeCode = String(e?.cause?.code ?? "").toUpperCase();

  // Undici / Node fetch transient socket drops
  if (causeCode === "UND_ERR_SOCKET") return true;

  // Common “connection dropped” patterns
  if (msg.includes("connection error")) return true;
  if (msg.includes("fetch failed")) return true;
  if (msg.includes("other side closed")) return true;
  if (msg.includes("socket")) return true;
  if (msg.includes("econnreset")) return true;
  if (msg.includes("etimedout")) return true;
  if (msg.includes("eai_again")) return true;

  // If upstream library sets a code
  if (code.includes("ECONNRESET")) return true;
  if (code.includes("ETIMEDOUT")) return true;

  return false;
}

async function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const e = new Error(`Engine timeout after ${timeoutMs}ms`);
      (e as any).code = "ENGINE_TIMEOUT";
      reject(e);
    }, timeoutMs);
  });

  try {
    return await Promise.race([p, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Exported engine function used across the app.
 * Same name, same signature, hardened execution.
 */
export const generateAnglesAndVariantsFromBrief: GenerateFn = async (
  ...args
) => {
  const timeoutMs = readNumberEnv("APPATIZE_ENGINE_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const maxRetries = Math.max(
    0,
    Math.min(5, readNumberEnv("APPATIZE_ENGINE_MAX_RETRIES", DEFAULT_MAX_RETRIES))
  );

  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Bound each attempt; avoids multi-minute hangs before a socket drop.
      return await withTimeout(_generate(...args), timeoutMs);
    } catch (err) {
      lastErr = err;

      const transient = isTransientNetworkError(err);
      const isLastAttempt = attempt >= maxRetries;

      // Fail fast on non-transient errors (prompt/contract bugs, etc.)
      if (!transient || isLastAttempt) {
        throw err;
      }

      // Deterministic exponential backoff before retrying.
      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoff);
    }
  }

  // Should never reach here, but keep deterministic.
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Engine failed with unknown error");
};
