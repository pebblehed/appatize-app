// src/engine/trends.ts
//
// Core trend engine types + interpreter + Stage 1 mock signals.
//
// This file is stable, aligned with the Appatize intelligence architecture,
// and forms the foundation for future real-signal adapters.
//
// No guessing, no drift. This is the canonical version.

import type { Trend, TrendStatus } from "@/context/BriefContext";

/**
 * Where a signal came from.
 * Later we’ll plug real adapters into these.
 */
export type SignalSource =
  | "reddit"
  | "x"
  | "google_trends"
  | "youtube"
  | "wikipedia"
  | "manual";

/**
 * Raw cultural signal from the outside world.
 * In Stage 2+, external APIs will construct this shape.
 */
export interface SignalEvent {
  id: string;
  source: SignalSource;
  label: string;        // e.g. "Street POV micro-vlogs"
  score: number;        // simple numeric “momentum” score (0–100+)
  volume?: number;      // optional relative volume
  tags: string[];       // platform, format, behaviours, etc.
  timestamp: string;    // ISO date string
}

/**
 * Signals clustered into a trend concept.
 * Multiple SignalEvents may support a single Trend.
 */
export interface TrendSignal {
  id: string;
  key: string;          // canonical key, e.g. "street_pov_micro_vlogs"
  label: string;        // human-readable trend name
  description: string;
  signals: SignalEvent[];
  category?: string;
}

/**
 * Trend interpreter:
 * TrendSignal[] → Trend[]
 *
 * The Trend type matches what BriefContext and the UI already use.
 */
export function interpretTrendSignals(trendSignals: TrendSignal[]): Trend[] {
  return trendSignals.map<Trend>((ts) => {
    const totalScore = ts.signals.reduce((sum, s) => sum + s.score, 0);
    const avgScore = ts.signals.length ? totalScore / ts.signals.length : 0;

    // Simple classification (will evolve in Stage 3).
    let status: TrendStatus;
    let momentumLabel: string;

    if (avgScore >= 75) {
      status = "Peaking";
      momentumLabel = "High velocity • Near peak saturation";
    } else if (avgScore >= 45) {
      status = "Emerging";
      momentumLabel = "Rising fast • Early but heating up";
    } else {
      status = "Stable";
      momentumLabel = "Consistent presence • Evergreen or niche";
    }

    return {
      id: ts.id,
      status,
      name: ts.label,
      description: ts.description,

      // FIXED: derive format from *all* signal tags, not ts.tags
      formatLabel: deriveFormatLabelFromTags(
        ts.signals.flatMap((s) => s.tags)
      ),

      momentumLabel,
      category: ts.category,
    };
  });
}

/**
 * Lightweight format inference from tags.
 * This will get smarter as real data arrives.
 */
function deriveFormatLabelFromTags(tags: string[]): string {
  const lower = tags.map((t) => t.toLowerCase());

  if (lower.some((t) => t.includes("shorts") || t.includes("short-form"))) {
    return "Short-form video";
  }
  if (lower.some((t) => t.includes("thread") || t.includes("tweet"))) {
    return "Threaded posts";
  }
  if (lower.some((t) => t.includes("carousel"))) {
    return "Carousel posts";
  }

  return "Mixed formats";
}

/**
 * Stage 1 mock signals — realistic shape matching the future real adapters.
 */
export function getMockTrendSignals(): TrendSignal[] {
  const now = new Date().toISOString();

  const s = (
    overrides: Partial<SignalEvent> & { label: string }
  ): SignalEvent => ({
    id: `signal-${Math.random().toString(36).slice(2)}`,
    source: "manual",
    score: 50,
    tags: [],
    volume: undefined,
    timestamp: now,
    ...overrides,
  });

  return [
    {
      id: "trend-street-pov",
      key: "street_pov_micro_vlogs",
      label: "Street POV micro-vlogs",
      description:
        "Handheld, first-person city walk POV content with captions and inner monologue audio.",
      category: "UGC storytelling",
      signals: [
        s({
          label: "TikTok POV city walks",
          score: 78,
          tags: ["tiktok", "short-form", "pov", "urban"],
        }),
        s({
          label: "YouTube Shorts: commute POVs",
          score: 64,
          tags: ["youtube_shorts", "short-form", "pov"],
        }),
      ],
    },

    {
      id: "trend-day-in-the-life",
      key: "day_in_the_life_work_content",
      label: "Day-in-the-life work content",
      description:
        "Relatable behind-the-scenes content showing how people actually work, live and create.",
      category: "Work-life",
      signals: [
        s({
          label: "TikTok workday vlogs",
          score: 72,
          tags: ["tiktok", "short-form", "vlog"],
        }),
        s({
          label: "LinkedIn ‘a day in my role’ posts",
          score: 55,
          tags: ["linkedin", "thread", "work"],
        }),
      ],
    },

    {
      id: "trend-expectation-vs-reality",
      key: "expectation_vs_reality_memes",
      label: "Expectation vs reality memes",
      description:
        "Evergreen meme format contrasting ideal vs actual outcomes, constantly remixed.",
      category: "Meme format",
      signals: [
        s({
          label: "X text + image macro threads",
          score: 40,
          tags: ["x", "thread", "meme"],
        }),
        s({
          label: "IG carousel ‘expectation vs reality’",
          score: 48,
          tags: ["instagram", "carousel", "meme"],
        }),
      ],
    },
  ];
}

/**
 * Convenience helper for API routes or future server components.
 */
export function getMockTrends(): Trend[] {
  const signals = getMockTrendSignals();
  return interpretTrendSignals(signals);
}
