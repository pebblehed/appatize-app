// src/app/api/trends/live/route.ts
//
// Live Trends API (deterministic, never-500)
//
// Purpose:
// - Surface Trend[] for the UI from live signal sources.
// - Stage 3+ logic (decision surfacing etc.) is already embedded in the engine output.
//
// Current wiring (minimal):
// - Uses the existing Stage 2 Reddit endpoint as the live signal source:
//   GET /api/signals/reddit?pack=fragrance&limit=25
//
// Rules:
// - Never 500
// - Safe empty states
// - Do NOT fake intelligence: if upstream is unavailable, return [] with status=unavailable.
//
// Stage 3.5+ UI NOTE:
// - The UI Evidence drawer expects `trend.evidence` fields.
// - Upstream Trend objects currently do NOT include evidence primitives,
//   so we attach a minimal deterministic evidence object here (no extra calls).

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type LiveTrendsResponse = {
  source: string;
  mode?: string;
  status: "ok" | "unavailable";
  count: number;
  trends: any[];
  message?: string;
  telemetry?: any;
};

function parseLimit(raw: string | null, fallback: number) {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 50);
}

function getOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

async function safeFetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Attach minimal evidence primitives to a Trend object if missing.
 *
 * We do NOT add any new intelligence or make any additional network calls here.
 * We only provide deterministic primitives so the UI Evidence drawer can render:
 * - Density (signalCount)
 * - Breadth (sourceCount)
 *
 * Until upstream includes timestamps, we leave freshness/age/velocity undefined.
 */
function ensureEvidence(trend: any) {
  if (!trend || typeof trend !== "object") return trend;

  // If upstream already provides evidence, do not touch it.
  if (trend.evidence && typeof trend.evidence === "object") return trend;

  // Minimal deterministic defaults:
  // Current Reddit adapter is effectively 1-post → 1-trend, so:
  // - density = 1
  // - breadth = 1
  const evidence = {
    signalCount: 1,
    sourceCount: 1,
    firstSeenAt: undefined as string | undefined,
    lastConfirmedAt: undefined as string | undefined,
    ageHours: undefined as number | undefined,
    recencyMins: undefined as number | undefined,
    velocityPerHour: undefined as number | undefined,
  };

  return {
    ...trend,
    evidence,
  };
}

export async function GET(request: Request) {
  const origin = getOrigin(request);

  try {
    const { searchParams } = new URL(request.url);

    // preferred params for live
    const pack = (searchParams.get("pack") || "fragrance").trim().toLowerCase();
    const limit = parseLimit(searchParams.get("limit"), 25);

    // Call the already-working live endpoint.
    const url = origin
      ? `${origin}/api/signals/reddit?pack=${encodeURIComponent(pack)}&limit=${limit}`
      : `/api/signals/reddit?pack=${encodeURIComponent(pack)}&limit=${limit}`;

    const upstream = await safeFetchJSON<LiveTrendsResponse>(url);

    // If upstream is missing or reports unavailable, return safe empty (never-500).
    if (!upstream || upstream.status !== "ok") {
      return NextResponse.json(
        {
          source: "live",
          status: "unavailable",
          count: 0,
          trends: [],
          message: upstream?.message || "Live source unavailable right now (reddit).",
          debug: {
            pack,
            limit,
            upstream: upstream
              ? { source: upstream.source, status: upstream.status }
              : null,
          },
        },
        { status: 200 }
      );
    }

    const rawTrends = Array.isArray(upstream.trends) ? upstream.trends : [];

    // Attach evidence primitives (UI-only support; deterministic)
    const trends = rawTrends.map(ensureEvidence);

    // Return stable contract expected by UI.
    return NextResponse.json({
      source: "live",
      status: "ok",
      count: trends.length,
      trends,
      // keep useful upstream telemetry for debugging but don’t change the Trend[] shape beyond evidence
      debug: {
        pack,
        limit,
        upstreamSource: upstream.source,
        telemetry: upstream.telemetry ?? null,
      },
    });
  } catch (err) {
    console.error("[/api/trends/live] error:", err);

    return NextResponse.json(
      {
        source: "live",
        status: "unavailable",
        count: 0,
        trends: [],
        message: "Unable to build live trends right now.",
      },
      { status: 200 } // never-500 rule
    );
  }
}
