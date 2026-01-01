// src/app/api/trends/live/route.ts
//
// Live Trends API (minimal, deterministic, never-500)
//
// This route returns Trend[] from the core trend engine.
// Right now it uses the engine's mock signals (Stage 1/2 baseline),
// but it already includes Stage-3.2 decision surfacing because
// src/engine/trends.ts spreads ...decision into each Trend.
//
// Contract:
// - Never 500
// - Always return JSON with { source, status, count, trends }

import { NextResponse } from "next/server";
import { getMockTrends } from "@/engine/trends";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const trends = getMockTrends();

    return NextResponse.json({
      source: "mock",
      status: "ok",
      count: trends.length,
      trends,
    });
  } catch (err) {
    console.error("[/api/trends/live] error:", err);

    return NextResponse.json(
      {
        source: "mock",
        status: "error",
        count: 0,
        trends: [],
        message: "Unable to build trends right now.",
      },
      { status: 200 } // never-500 rule
    );
  }
}
