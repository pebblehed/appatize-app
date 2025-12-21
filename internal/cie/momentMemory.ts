// src/internal/cie/momentMemory.ts
//
// Stage D.4 — Moment Memory Store
// Goal: a stable singleton across route handlers in dev + deploy.
// IMPORTANT: This is an in-memory store. In serverless, it is best-effort.
// Next stage: persist to Redis/DB. For now, globalThis gives maximum stability.

import type { MomentMemoryRecord } from "@internal/contracts/MOMENT_MEMORY_RECORD";

type Store = Map<string, MomentMemoryRecord>;

declare global {
  // eslint-disable-next-line no-var
  var __APPATIZE_MOMENT_MEMORY__: Store | undefined;
}

function getStore(): Store {
  if (!globalThis.__APPATIZE_MOMENT_MEMORY__) {
    globalThis.__APPATIZE_MOMENT_MEMORY__ = new Map();
  }
  return globalThis.__APPATIZE_MOMENT_MEMORY__;
}

export function getMomentMemory(momentId: string): MomentMemoryRecord | null {
  if (!momentId) return null;
  const store = getStore();
  return store.get(momentId) ?? null;
}

/**
 * Write moment memory. If __writeOnce is true and record exists, we keep original.
 * Never throw — Stage D rule: memory cannot break surfaces.
 */
export function writeMomentMemory(record: MomentMemoryRecord): boolean {
  try {
    if (!record?.momentId) return false;

    const store = getStore();
    const existing = store.get(record.momentId);

    // Write-once semantics
    const writeOnce = Boolean((record as any).__writeOnce);
    if (writeOnce && existing) return true;

    store.set(record.momentId, record);
    return true;
  } catch {
    return false;
  }
}

/**
 * Optional helper: useful for debugging & UI gating.
 */
export function hasMomentMemory(momentId: string): boolean {
  const store = getStore();
  return store.has(momentId);
}

/**
 * Optional helper: dev-only manual reset if needed.
 */
export function clearMomentMemory(): void {
  const store = getStore();
  store.clear();
}
