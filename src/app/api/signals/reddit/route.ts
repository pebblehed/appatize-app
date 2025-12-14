// src/app/api/signals/reddit/route.ts
//
// Stage D — Intelligence Hardening
// Reddit is fallback-only. This route must NEVER 500.

import { NextResponse } from "next/server";
import { fetchRedditTrends } from "@/engine/reddit";

export const dynamic = "force-dynamic";

const DEFAULT_SUBREDDITS = ["socialmedia", "marketing"];

type RedditSignalStatus =
  | "ok"
  | "fallback_unavailable"
  | "disabled";

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

  /**
   * Stage D rule:
   * Reddit is NOT a required dependency.
   * This route must return a valid response shape in all cases.
   */

  try {
    const trends = await fetchRedditTrends(subreddits, 10);

    // Defensive: ensure non-empty, well-formed array
    if (!Array.isArray(trends) || trends.length === 0) {
      return NextResponse.json({
        source: "reddit",
        mode: "fallback",
        status: "fallback_unavailable" as RedditSignalStatus,
        subreddits,
        count: 0,
        trends: [],
        message: "Reddit returned no usable signals",
      });
    }

    return NextResponse.json({
      source: "reddit",
      mode: "fallback",
      status: "ok" as RedditSignalStatus,
      subreddits,
      count: trends.length,
      trends,
    });
  } catch (err) {
    console.warn("[RedditRoute] Fallback failure:", err);

    // IMPORTANT: never 500
    return NextResponse.json({
      source: "reddit",
      mode: "fallback",
      status: "fallback_unavailable" as RedditSignalStatus,
      subreddits,
      count: 0,
      trends: [],
      message: "Reddit signal temporarily unavailable",
    });
  }
}
