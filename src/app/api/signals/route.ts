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
//
// Stage D.5 NOTE:
// - We preserve `summary` on items so moment lifecycle evaluation has evidence text.

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
  summary?: string;
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

function safeStr(x: any): string {
  return typeof x === "string" ? x : "";
}

export async function GET() {
  const [hnRes, redditRes] = await Promise.all([
    safeFetch<any>("http://localhost:3000/api/signals/hn?limit=20"),
    safeFetch<any>("http://localhost:3000/api/signals/reddit"),
  ]);

  const items: SignalItem[] = [];
  const sources: SourceHealth[] = [];

  // --- HN (primary) ---
  if (hnRes && hnRes.status === "ok") {
    const hnItems = Array.isArray(hnRes.items) ? hnRes.items : [];
    items.push(
      ...hnItems.map((it: any) => ({
        id: safeStr(it?.id),
        source: safeStr(it?.source) || "hn",
        title: safeStr(it?.title),
        summary: safeStr(it?.summary) || undefined,
        url: typeof it?.url === "string" ? it.url : undefined,
        author: typeof it?.author === "string" ? it.author : undefined,
        score: typeof it?.score === "number" ? it.score : undefined,
        createdAtISO: typeof it?.createdAtISO === "string" ? it.createdAtISO : undefined,
      }))
    );

    sources.push({
      source: "hn",
      mode: "live",
      status: "ok",
      count: hnItems.length,
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
    const redditItems = Array.isArray(redditRes.trends) ? redditRes.trends : [];
    items.push(
      ...redditItems.map((it: any) => ({
        id: safeStr(it?.id),
        source: "reddit",
        title: safeStr(it?.title || it?.name),
        summary: safeStr(it?.summary || it?.description) || undefined,
        url: typeof it?.url === "string" ? it.url : undefined,
        author: typeof it?.author === "string" ? it.author : undefined,
        score: typeof it?.score === "number" ? it.score : undefined,
        createdAtISO: typeof it?.createdAtISO === "string" ? it.createdAtISO : undefined,
      }))
    );

    sources.push({
      source: "reddit",
      mode: "fallback",
      status: "ok",
      count: redditItems.length,
    });
  } else {
    sources.push({
      source: "reddit",
      mode: "fallback",
      status: "unavailable",
      count: 0,
    });
  }

  const available = sources.some((s) => s.status === "ok");

  return NextResponse.json({
    available,
    totalCount: items.length,
    sources,
    items,
  });
}
