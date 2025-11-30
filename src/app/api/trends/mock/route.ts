// src/app/api/trends/mock/route.ts

import { NextResponse } from "next/server";
import { getMockTrends } from "@/engine/trends";

/**
 * GET /api/trends/mock
 *
 * Stage 1 test endpoint:
 * Returns interpreted Trend[] from our mock signals.
 */
export async function GET() {
  const trends = getMockTrends();

  return NextResponse.json({
    source: "mock-stage-1",
    count: trends.length,
    trends,
  });
}
