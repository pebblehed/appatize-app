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

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type HnSignalStatus = "ok" | "unavailable";

type HnItem = {
  id: string; // "hn:<id>"
  source: "hn";
  title: string;
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

/**
 * Pull IDs from HN "newstories" and hydrate the first N story items.
 * We keep this minimal and resilient.
 */
async function fetchHnSignals(limit: number): Promise<HnItem[]> {
  const { signal, cleanup } = withTimeout(8000);

  try {
    const ids = await fetchJson<number[]>(`${HN_BASE}/newstories.json`, signal);

    const slice = Array.isArray(ids) ? ids.slice(0, Math.min(limit, 30)) : [];
    if (slice.length === 0) return [];

    // Hydrate story items in parallel (small batch)
    const rawItems = await Promise.all(
      slice.map(async (id) => {
        try {
          return await fetchJson<any>(`${HN_BASE}/item/${id}.json`, signal);
        } catch {
          return null;
        }
      })
    );

    const items: HnItem[] = rawItems
      .filter(Boolean)
      .map((d: any) => {
        const title = String(d?.title ?? "").trim();
        if (!title) return null;

        return {
          id: `hn:${d.id}`,
          source: "hn",
          title,
          url: d?.url ? String(d.url) : undefined,
          author: d?.by ? String(d.by) : undefined,
          score: typeof d?.score === "number" ? d.score : undefined,
          createdAtISO:
            typeof d?.time === "number"
              ? new Date(d.time * 1000).toISOString()
              : undefined,
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

    // Even if empty, this is still a valid response shape.
    return NextResponse.json({
      source: "hn",
      mode: "live", // HN is primary and unauthenticated
      status: "ok" as HnSignalStatus,
      count: items.length,
      items,
    });
  } catch (err) {
    console.warn("[HNRoute] Signal unavailable:", err);

    // Stage D: never 500
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
