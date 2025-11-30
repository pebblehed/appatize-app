// src/app/api/signals/reddit/route.ts
//
// Stage 2: Real-signal endpoint (Reddit).
// GET /api/signals/reddit?subs=socialmedia,marketing
// Returns Trend[] interpreted from live Reddit topics.

import { NextResponse } from "next/server";
import { fetchRedditTrends } from "@/engine/reddit";

export const dynamic = "force-dynamic";

const DEFAULT_SUBREDDITS = ["socialmedia", "marketing"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const subsParam = searchParams.get("subs");
  const subreddits =
    subsParam && subsParam.trim().length > 0
      ? subsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : DEFAULT_SUBREDDITS;

  try {
    const trends = await fetchRedditTrends(subreddits, 10);

    return NextResponse.json({
      source: "reddit",
      subreddits,
      count: trends.length,
      trends,
    });
  } catch (err) {
    console.error("[RedditRoute] Error fetching trends:", err);
    return NextResponse.json(
      { error: "Failed to fetch Reddit trends" },
      { status: 500 }
    );
  }
}
