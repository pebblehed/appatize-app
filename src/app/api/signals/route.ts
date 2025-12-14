// src/app/api/signals/route.ts
//
// Stage D — Signal Router
// Aggregates all signal sources into a single, stable contract.
// This endpoint is the ONLY entry point for intelligence.
//
// Rules:
// - Never 500
// - Explicit health per source
// - Safe empty states
// - No platform can break the app

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SourceHealth = {
  source: string;
  mode: "live" | "fallback" | "disabled";
  status: "ok" | "unavailable";
  count: number;
};

type SignalItem = {
  id: string;
  source: string;
  title: string;
  url?: string;
  author?: string;
  score?: number;
  createdAtISO?: string;
};

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET() {
  /**
   * Fetch in parallel, but isolate failures.
   */
  const [hnRes, redditRes] = await Promise.all([
    safeFetch<any>("http://localhost:3000/api/signals/hn?limit=20"),
    safeFetch<any>("http://localhost:3000/api/signals/reddit"),
  ]);

  const items: SignalItem[] = [];
  const sources: SourceHealth[] = [];

  // --- HN (primary) ---
  if (hnRes && hnRes.status === "ok") {
    items.push(...hnRes.items);
    sources.push({
      source: "hn",
      mode: "live",
      status: "ok",
      count: hnRes.items.length,
    });
  } else {
    sources.push({
      source: "hn",
      mode: "live",
      status: "unavailable",
      count: 0,
    });
  }

  // --- Reddit (fallback-only) ---
  if (redditRes && redditRes.status === "ok") {
    items.push(...redditRes.trends);
    sources.push({
      source: "reddit",
      mode: "fallback",
      status: "ok",
      count: redditRes.trends.length,
    });
  } else {
    sources.push({
      source: "reddit",
      mode: "fallback",
      status: "unavailable",
      count: 0,
    });
  }

  /**
   * Global availability:
   * At least one source must be ok.
   */
  const available = sources.some((s) => s.status === "ok");

  return NextResponse.json({
    available,
    totalCount: items.length,
    sources,
    items,
  });
}
