// src/app/api/signals/hn/route.ts
//
// Stage D — Intelligence Hardening
// Primary signal endpoint (Hacker News).
// GET /api/signals/hn?limit=20
//
// Rules:
// - Must NEVER 500 (no platform can break the app)
// - Must always return a contract-safe shape
// - UI can safely render based on status + items
//
// Stage D.5 NOTE:
// - We emit `summary` so lifecycle/drift evaluation has comparable evidence text.
// - For Ask HN / Show HN, HN provides `text` (HTML). We strip it deterministically.
// - For link stories, summary may be empty, but title still carries the core identity.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type HnSignalStatus = "ok" | "unavailable";

type HnItem = {
  id: string; // "hn:<id>"
  source: "hn";
  title: string;
  summary?: string; // Stage D.5 evidence text
  url?: string;
  author?: string;
  score?: number;
  createdAtISO?: string;
};

const HN_BASE = "https://hacker-news.firebaseio.com/v0";

/**
 * Small helper to avoid hanging requests.
 */
function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return (await res.json()) as T;
}

function safeFiniteNumber(n: any, fallback = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function safeUrl(raw: any): string | undefined {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

function safeIsoFromUnixSeconds(raw: any): string | undefined {
  const sec = typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(sec)) return undefined;
  const d = new Date(sec * 1000);
  const t = d.getTime();
  if (!Number.isFinite(t)) return undefined;
  return d.toISOString();
}

/**
 * Deterministic HTML -> plain text
 * (HN `text` can be HTML for Ask HN / Show HN)
 */
function stripHtmlToText(html: any): string {
  const s = typeof html === "string" ? html : "";
  if (!s) return "";
  return s
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, max = 280): string {
  const t = (s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/**
 * Pull IDs from HN "newstories" and hydrate the first N story items.
 * Resilient, deterministic, and schema-stable.
 */
async function fetchHnSignals(limit: number): Promise<HnItem[]> {
  const { signal, cleanup } = withTimeout(8000);

  try {
    const ids = await fetchJson<number[]>(`${HN_BASE}/newstories.json`, signal);

    const slice = Array.isArray(ids) ? ids.slice(0, Math.min(limit, 30)) : [];
    if (slice.length === 0) return [];

    const rawItems = await Promise.all(
      slice.map(async (hnId) => {
        const { signal: itemSignal, cleanup: itemCleanup } = withTimeout(3500);
        try {
          const d = await fetchJson<any>(`${HN_BASE}/item/${hnId}.json`, itemSignal);
          return d ?? null;
        } catch {
          return null;
        } finally {
          itemCleanup();
        }
      })
    );

    const items: HnItem[] = rawItems
      .filter(Boolean)
      .map((d: any) => {
        const title = String(d?.title ?? "").trim();
        if (!title) return null;

        if (typeof d?.type === "string" && d.type !== "story") return null;

        const rawId =
          typeof d?.id === "number" || typeof d?.id === "string"
            ? String(d.id).trim()
            : "";
        if (!rawId) return null;

        const url = safeUrl(d?.url);
        const author = typeof d?.by === "string" ? String(d.by).trim() : undefined;
        const score = safeFiniteNumber(d?.score, 0);
        const createdAtISO = safeIsoFromUnixSeconds(d?.time);

        // HN provides `text` for Ask HN / Show HN style items.
        const summaryFromText = truncate(stripHtmlToText(d?.text), 320);

        // If no text exists, we still emit empty summary (title carries identity).
        const summary = summaryFromText || "";

        return {
          id: `hn:${rawId}`,
          source: "hn",
          title,
          summary,
          url,
          author,
          score,
          createdAtISO,
        } as HnItem;
      })
      .filter(Boolean) as HnItem[];

    return items;
  } finally {
    cleanup();
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");

  const limit = (() => {
    const n = Number(limitParam ?? 20);
    if (!Number.isFinite(n)) return 20;
    return Math.max(1, Math.min(30, Math.floor(n)));
  })();

  try {
    const items = await fetchHnSignals(limit);

    return NextResponse.json({
      source: "hn",
      mode: "live",
      status: "ok" as HnSignalStatus,
      count: items.length,
      items,
    });
  } catch (err) {
    console.warn("[HNRoute] Signal unavailable:", err);

    return NextResponse.json({
      source: "hn",
      mode: "live",
      status: "unavailable" as HnSignalStatus,
      count: 0,
      items: [],
      message: "HN signal temporarily unavailable",
    });
  }
}
