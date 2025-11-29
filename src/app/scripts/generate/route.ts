// src/app/api/scripts/generate/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Types for incoming payload
 */
type PlatformMode =
  | "tiktok"
  | "reels"
  | "shorts"
  | "x"
  | "linkedin"
  | "youtube";

interface GenerateRequestBody {
  brief: any; // flexible – we normalise inside the generator
  platformMode?: PlatformMode;
}

/**
 * Small description of each platform's style.
 * Used in the mock generator for now, and later as part of the AI prompt.
 */
const PLATFORM_STYLE_SNIPPETS: Record<PlatformMode, string> = {
  tiktok:
    "Fast-paced, native creator voice, jump cuts implied, hook in first 1–2 seconds, on-screen text cues.",
  reels:
    "Aesthetic, emotionally resonant, smoother pacing, visually-driven moments, aspirational but human.",
  shorts:
    "High energy, punchy, ultra-condensed, strong hook up front, minimal fluff, direct value.",
  x: "Narration-led, opinionated, strong point of view, structured like a spoken thread, punchy lines.",
  linkedin:
    "Professional and insight-led, expert but relatable, focused on authority, clarity, and tangible takeaways.",
  youtube:
    "Structured like A-roll + B-roll, clear intro, promise, body, and outro; room for storytelling and depth.",
};

/**
 * Fallback mock generator so the app works without any AI key.
 * This gives you platform-aware scripts immediately.
 */
function generateMockScript(brief: any, platformMode: PlatformMode): string {
  // 🔄 Safely normalise fields in case they’re strings or objects
  const rawTitle = brief?.title;
  const title =
    typeof rawTitle === "string"
      ? rawTitle
      : rawTitle?.name ||
        rawTitle?.label ||
        rawTitle?.text ||
        "Untitled content concept";

  const rawTrend = brief?.trend;
  const trend =
    typeof rawTrend === "string"
      ? rawTrend
      : rawTrend?.name ||
        rawTrend?.label ||
        rawTrend?.description ||
        "cultural trend";

  const rawObjective = brief?.objective;
  const objective =
    typeof rawObjective === "string"
      ? rawObjective
      : rawObjective?.summary ||
        rawObjective?.text ||
        "Drive awareness and engagement for the brand.";

  const audience =
    brief?.audience || "busy, online-native viewers who scroll quickly.";
  const brandVoice =
    brief?.brandVoice ||
    "smart, culturally fluent, and non-cringe; confident but not shouty.";

  const styleSnippet = PLATFORM_STYLE_SNIPPETS[platformMode];

  const platformLabel =
    platformMode === "x"
      ? "X (Twitter) video"
      : platformMode === "shorts"
      ? "YouTube Shorts"
      : platformMode[0].toUpperCase() + platformMode.slice(1);

  return [
    `# ${platformLabel} Script — ${title}`,
    "",
    `Trend focus: ${trend}`,
    `Objective: ${objective}`,
    `Target: ${audience}`,
    "",
    `Platform style: ${styleSnippet}`,
    `Brand voice: ${brandVoice}`,
    "",
    "----",
    "",
    "🎬 **Structure**",
    "",
    platformMode === "youtube"
      ? [
          "1. Cold open / pattern break (0–3s)",
          "2. Hook + promise",
          "3. Body (3–5 main beats, each visually grounded)",
          "4. Social proof / credibility moment",
          "5. Call-to-action",
        ].join("\n")
      : platformMode === "linkedin"
      ? [
          "1. Relatable tension / problem in one strong line",
          "2. Insight: what most brands/people get wrong",
          "3. Framework or simple mental model",
          "4. Example in the wild",
          "5. Soft CTA or perspective close.",
        ].join("\n")
      : [
          "1. Pattern-break visual moment",
          "2. Hook line that names the tension",
          "3. 2–3 quick beats that resolve it",
          "4. Close with a simple, native CTA.",
        ].join("\n"),
    "",
    "----",
    "",
    "📜 **Script (voice + on-screen cues)**",
    "",
    platformMode === "tiktok"
      ? [
          "[OPEN — POV shot, slightly shaky, text on screen: “You’re doing content backwards.”]",
          "",
          'VO: "You’re doing content backwards."',
          'VO: "You post, *then* hope it hits a trend."',
          "",
          "[Cut — quick zoom-in]",
          `VO: "Instead, flip it. Start with this week’s cultural spike — sounds, story formats, POVs — then wrap your brand around it."`,
          "",
          `[On-screen text: “Start with culture → Then add your brand”]`,
          `VO: "For this drop, we’re leaning into ‘${trend}’ — raw, in-the-city micro moments. No polished sets, just real movement."`,
          "",
          "[B-roll idea: product in motion, street clips, behind-the-scenes.]",
          'VO: "Three shots: one tension, one transformation, one tiny flex. That’s it."',
          "",
          '[On-screen CTA: “Save this and steal the format.”]',
        ].join("\n")
      : platformMode === "reels"
      ? [
          "[OPEN — Slow dolly or handheld, ambient city / workspace / lifestyle scene.]",
          'On-screen text: "The brands that win in 2025 feel like people."',
          "",
          'VO: "The brands that win this year don’t shout. They *feel* like people you actually want in your feed."',
          "",
          "[Cut to closer shot / product in-hand.]",
          `VO: "That’s why we’re tapping into ‘${trend}’ — quick glimpses into real days, real chaos, real joy."`,
          "",
          "[Montage: 3–4 micro-moments that show the product in context.]",
          'VO: "No 90-second ads. Just 7-second stories that slot into the way you already scroll."',
          "",
          '[Soft CTA overlay: “Follow for more real-day story formats.”]',
        ].join("\n")
      : platformMode === "shorts"
      ? [
          "[OPEN — immediate pattern break. Fast zoom, unexpected visual.]",
          'VO: "You’re wasting 80% of your content budget."',
          "",
          'VO: "Because you ignore what YouTube is literally telling you people binge right now."',
          "",
          "[On-screen: quick flash of trending Shorts grid (mock).]",
          `VO: "This format? ‘${trend}’. It’s dominating right now. So here’s how we hijack it for your brand in 3 beats:"`,
          "",
          'VO: "Beat 1: Name the tension your audience is in."',
          'VO: "Beat 2: Show the transformation in under 4 seconds."',
          'VO: "Beat 3: Close with a tiny flex — stat, reaction, or visual punchline."',
          "",
          '[CTA: text on screen — “Steal this format. Hit subscribe if you want more.”]',
        ].join("\n")
      : platformMode === "x"
      ? [
          "[OPEN — creator to camera, simple background.]",
          'VO: "Everyone’s reposting the same viral clips… and then wondering why nothing converts."',
          "",
          'VO: "If you’re a brand, you don’t need more noise. You need *a clear POV* on what ‘${trend}’ actually means for your customer."',
          "",
          "[On-screen overlay: bullet points appear as they’re spoken.]",
          'VO: "Here’s how we structure X-native video around it:"',
          'VO: "One line that names the tension. One line that stakes your position. Three lines that show, not tell."',
          "",
          'VO: "Then clip it, thread it, quote-tweet it. One idea, five outputs."',
          "",
          '[CTA lower third: “Follow for daily POVs brands can actually use.”]',
        ].join("\n")
      : platformMode === "linkedin"
      ? [
          "[OPEN — calm, composed framing, subtle background.]",
          'VO: "Most brands treat culture like a trend report. Something you read once a quarter and file away."',
          "",
          'VO: "The ones that are winning? They treat it like an operating system for their content."',
          "",
          '[On-screen text: “From Trend → Operating System”]',
          `VO: "Take ‘${trend}’. On the surface, it’s just another format wave. But underneath, it’s telling you how your audience wants to be spoken to — fast, visual, and story-first."`,
          "",
          'VO: "So our play is simple: build a repeatable script kit that does three things:"',
          `VO: "1. Meets them where they scroll. 2. Feels creator-native, not brand-intrusive. 3. Still leads to clear business outcomes: ${objective}"`,
          "",
          '[Close with title card: “Culture as a Service Layer for Content” and soft CTA: “Connect if you want to build this into your 2025 content ops.”]',
        ].join("\n")
      : // youtube
        [
          "[INTRO — A-roll, direct to camera.]",
          'VO: "If your content calendar still starts in a spreadsheet, you’re already behind."',
          "",
          `VO: "In this video, I’m going to show you how we build full funnel campaigns *starting* from culture — using ‘${trend}’ as the backbone."`,
          "",
          "[Cut to B-roll of feeds, trend dashboards, creators posting.]",
          'VO: "We’ll break it into three parts: spotting the signal, building angles, and turning those angles into scripts your team can actually shoot."',
          "",
          "[CHAPTER 1 — Spotting the signal]",
          'VO: "First, we map the cultural spike: where it’s showing up, who’s driving it, and how your audience is reacting."',
          "",
          "[CHAPTER 2 — Building angles]",
          'VO: "Then we turn that into 5–10 creative angles — different POVs, characters, or scenarios — tailored to your brand voice."',
          "",
          "[CHAPTER 3 — Script system]",
          'VO: "Finally, we translate it into TikTok, Reels, Shorts, X clips, and LinkedIn hooks — all from one source of truth."',
          "",
          "[OUTRO — back to A-roll.]",
          'VO: "If you want this as a done-for-you system, that’s literally what we built Appatize for."',
        ].join("\n"),
    "",
    "----",
    "",
    "🎯 **Quick notes for creator / editor**",
    "",
    "- Keep pacing native to the platform — no generic cross-post feel.",
    "- Add on-screen text that reinforces the hook and key beats.",
    "- Show real context: feeds, people, spaces, not just product close-ups.",
    "- End with a clear, human CTA (save, share, follow, click) that feels earned, not bolted on.",
  ].join("\n");
}

/**
 * POST handler
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateRequestBody;

    const platformMode: PlatformMode =
      (body.platformMode as PlatformMode) || "tiktok";

    // Basic guard: if brief is missing, return 400
    if (!body.brief) {
      return NextResponse.json(
        { error: "Missing 'brief' in request body." },
        { status: 400 }
      );
    }

    const brief = body.brief;

    // For now: always use mock generator (no external dependency).
    // Later: if OPENAI_API_KEY is present, call the real AI-powered script engine instead.
    const script = generateMockScript(brief, platformMode);

    return NextResponse.json({ script }, { status: 200 });
  } catch (err: any) {
    console.error("[/api/scripts/generate] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to generate script.",
        details: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
