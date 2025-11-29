// src/app/api/generateTrendAngles/route.ts
import { NextResponse } from "next/server";

/**
 * MOCK trend angle generator for Appatize.
 *
 * The Trends page calls this with a POST request.
 * We respond with { angles: [...] } where each angle has the exact
 * shape that AngleCard expects:
 *
 * {
 *   id,
 *   label,
 *   hook,
 *   format,
 *   platform,
 *   audience,
 *   outcome,
 *   notes
 * }
 *
 * Later, you can replace the mock angles with a real AI call without
 * touching the front-end.
 */

type GenerateAnglesRequestBody = {
  trendTitle?: string;
  momentum?: string;
  format?: string;
  category?: string;
};

export async function POST(req: Request) {
  try {
    // Safely parse JSON body (fallback to {} if nothing sent)
    const body = (await req.json().catch(() => ({}))) as GenerateAnglesRequestBody;

    const trendTitle = body.trendTitle || "Untitled trend";
    const momentum = body.momentum || "Emerging";
    const format = body.format || "Short-form video";

    // Shortened label version for nicer angle titles
    const shortTrend =
      trendTitle.length > 40 ? trendTitle.slice(0, 37).trim() + "..." : trendTitle;

    const angles = [
      {
        id: "a1",
        label: `${shortTrend} as raw POV moments`,
        hook: "Make the viewer feel like they just opened your camera roll, not your ad account.",
        format,
        platform: "TikTok",
        audience: "Busy founders who scroll between calls",
        outcome: "Drive profile visits & warm DMs",
        notes:
          "Shoot handheld, mix in-screen recordings and messy B-roll. Keep pacing fast and captions punchy.",
      },
      {
        id: "a2",
        label: `${shortTrend} as 'before/after' mini-stories`,
        hook: "Show life before your product, then after — in one quick, punchy sequence.",
        format,
        platform: "Reels",
        audience: "Operators and marketing leads",
        outcome: "Generate saves and shares",
        notes:
          "Use jump cuts for the transition, and add a clear on-screen label for BEFORE vs AFTER.",
      },
      {
        id: "a3",
        label: `${shortTrend} as 'day in the life' micro-doc`,
        hook: "Follow one real person through their day and let the product sneak into the story.",
        format: "Mixed formats",
        platform: "TikTok / Reels",
        audience: "Brand-aware but sceptical buyers",
        outcome: "Build trust and familiarity",
        notes:
          "Keep it intimate, not polished. Use voiceover or on-screen text to narrate the story simply.",
      },
      {
        id: "a4",
        label: `${shortTrend} as meme-native commentary`,
        hook: "React to the trend with humour that feels like a friend roasting, not a brand preaching.",
        format: "Meme / Video",
        platform: "TikTok / Shorts",
        audience: "Younger, culture-native viewers",
        outcome: "Spark comments and stitches",
        notes:
          "Leverage trending audio where appropriate, but keep the joke tied back to your core problem.",
      },
    ];

    console.log("[generateTrendAngles] Generated angles for:", {
      trendTitle,
      momentum,
      format,
    });

    // The important part: respond with valid JSON under `angles`
    return NextResponse.json({ angles });
  } catch (error) {
    console.error("[generateTrendAngles] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate angles" },
      { status: 500 }
    );
  }
}
