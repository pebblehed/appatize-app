// src/engine/trends.ts
//
// Core trend engine types + interpreter + Stage 1 mock signals.
//
// This file is stable, aligned with the Appatize intelligence architecture,
// and forms the foundation for future real-signal adapters.
//
// No guessing, no drift. This is the canonical version.

import type { Trend, TrendStatus } from "@/context/BriefContext";
import { surfaceDecision } from "@/lib/intelligence/decisionSurfacing";

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
  | "manual"
  | "instagram";

/**
 * Raw cultural signal from the outside world.
 */
export interface SignalEvent {
  id: string;
  source: SignalSource;
  label: string;
  score: number;
  volume?: number;
  tags: string[];
  timestamp: string;
}

/**
 * Signals clustered into a trend concept.
 */
export interface TrendSignal {
  id: string;
  key: string;
  label: string;
  description: string;
  signals: SignalEvent[];
  category?: string;
}

/**
 * Evidence primitives (deterministic, non-generative).
 */
type Evidence = {
  signalCount: number;

  /**
   * NOTE (Stage D.6 wiring reality):
   * Until we have multi-platform adapters, platform sourceCount will be 1 for Reddit-only.
   * For decision surfacing, we need a breadth proxy that is still truth-only.
   *
   * We therefore define evidence.sourceCount as "distinct contributing sources within available input scope".
   * In Reddit-only scope, that means distinct subreddits participating in the cluster.
   */
  sourceCount: number;

  // Optional extra clarity fields (do not break UI; safe additive)
  platformSourceCount?: number;
  subredditCount?: number;

  firstSeenAt?: string;
  lastConfirmedAt?: string;
  ageHours?: number;
  recencyMins?: number;
  velocityPerHour?: number;
  momentQualityScore?: number;
};

/**
 * Extract subreddit tags like "subreddit:fragrance"
 */
function extractSubredditsFromTags(tags: string[]): string[] {
  return (tags || [])
    .filter((t) => typeof t === "string" && t.startsWith("subreddit:"))
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Deterministic quality proxy (0–100) derived ONLY from existing primitives:
 * - avgScore (ups/score)
 * - totalVolume (comments)
 * - velocityPerHour (if available)
 *
 * Purpose: give decision surfacing something stronger than pure counts when evidence is genuinely hot,
 * without inventing any intelligence.
 */
function computeMomentQualityScore(args: {
  avgScore: number;
  totalVolume: number;
  velocityPerHour?: number;
}): number {
  const { avgScore, totalVolume, velocityPerHour } = args;

  // Score: squash into 0..100 (Reddit ups can be large; cap deterministically)
  const scoreComponent = clamp(avgScore, 0, 300) / 3; // 0..100

  // Volume: log squash (comments), 0..~100
  const vol = Math.max(0, totalVolume);
  const volumeComponent = clamp(Math.log10(1 + vol) * 40, 0, 100); // ~0..100

  // Velocity: signals per hour, also squashed (clusters can be small)
  const v = velocityPerHour != null ? Math.max(0, velocityPerHour) : 0;
  const velocityComponent = clamp(v * 15, 0, 100);

  // Weighted blend (deterministic)
  const blended = scoreComponent * 0.55 + volumeComponent * 0.3 + velocityComponent * 0.15;

  // Keep stable 2dp → integer-ish feel (but still number)
  return Number(blended.toFixed(2));
}

/**
 * Trend interpreter:
 * TrendSignal[] → Trend[]
 */
export function interpretTrendSignals(trendSignals: TrendSignal[]): Trend[] {
  return trendSignals.map<Trend>((ts) => {
    const totalScore = ts.signals.reduce((sum, s) => sum + s.score, 0);
    const avgScore = ts.signals.length ? totalScore / ts.signals.length : 0;

    const totalVolume = ts.signals.reduce((sum, s) => sum + (s.volume ?? 0), 0);

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

    const allTags = ts.signals.flatMap((s) => s.tags);

    const marketLabel = deriveMarketLabelFromTags(allTags);
    const category = mergeCategoryWithMarket(ts.category, marketLabel);

    // ---- Evidence primitives ----
    const items = ts.signals;

    const signalCount = items.length;

    // Platform count (future-proof, stays 1 for Reddit-only)
    const platformSourceCount = new Set(items.map((it) => it.source).filter(Boolean)).size;

    // Subreddit breadth proxy (truth-only within Reddit scope)
    const subredditCount = new Set(items.flatMap((it) => extractSubredditsFromTags(it.tags || [])))
      .size;

    // Stage D.6: breadth proxy
    const sourceCount = Math.max(1, platformSourceCount, subredditCount);

    const timestamps = items
      .map((it) => it.timestamp)
      .filter((v) => typeof v === "string" && v.length > 0)
      .map((iso) => Date.parse(iso))
      .filter((ms) => Number.isFinite(ms))
      .sort((a, b) => a - b);

    const firstSeenAt = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : undefined;

    const lastConfirmedAt =
      timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : undefined;

    const nowMs = Date.now();

    const ageHours =
      firstSeenAt != null
        ? Math.max(0, (nowMs - Date.parse(firstSeenAt)) / (1000 * 60 * 60))
        : undefined;

    const recencyMins =
      lastConfirmedAt != null
        ? Math.max(0, (nowMs - Date.parse(lastConfirmedAt)) / (1000 * 60))
        : undefined;

    // Velocity: signals per hour since first seen (guardrailed)
    const velocityPerHour =
      ageHours != null
        ? ageHours >= 0.25
          ? Number((signalCount / ageHours).toFixed(2))
          : undefined
        : undefined;

    const momentQualityScore = computeMomentQualityScore({
      avgScore,
      totalVolume,
      velocityPerHour,
    });

    const evidence: Evidence = {
      signalCount,
      sourceCount,
      platformSourceCount,
      subredditCount,
      firstSeenAt,
      lastConfirmedAt,
      ageHours: ageHours != null ? Number(ageHours.toFixed(2)) : undefined,
      recencyMins: recencyMins != null ? Number(recencyMins.toFixed(2)) : undefined,
      velocityPerHour,
      momentQualityScore,
    };

    // Decision surfacing (same primitives + deterministic quality proxy)
    const decision = surfaceDecision({
      signalCount,
      sourceCount,
      firstSeenAt,
      lastConfirmedAt,

      // Provide both keys for total compatibility
      momentQualityScore,
      qualityScore: momentQualityScore,
    });

    return {
      id: ts.id,
      status,
      name: ts.label,
      description: ts.description,
      formatLabel: deriveFormatLabelFromTags(allTags),
      momentumLabel,
      category,

      debugScore: totalScore,
      debugVolume: totalVolume,

      ...decision,
      evidence,
    };
  });
}

/**
 * Lightweight format inference from tags.
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
 * Deterministic market label from tags:
 * Looks for tags like "market:fragrance".
 */
function deriveMarketLabelFromTags(tags: string[]): string | null {
  const markets = new Set<string>();

  for (const t of tags) {
    const lower = (t || "").toLowerCase().trim();
    if (!lower.startsWith("market:")) continue;
    const raw = lower.slice("market:".length).trim();
    if (!raw) continue;
    markets.add(raw);
  }

  if (markets.size === 0) return null;

  const list = Array.from(markets).sort();
  const pretty = list
    .slice(0, 2)
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
    .join(" + ");

  return `Market: ${pretty}`;
}

function mergeCategoryWithMarket(
  category: string | undefined,
  marketLabel: string | null
): string | undefined {
  if (!marketLabel) return category;

  if (!category || category.trim().length === 0) return marketLabel;

  if (category.toLowerCase().includes("market:")) return category;

  return `${category} · ${marketLabel}`;
}

/**
 * Stage 1 mock signals — realistic shape matching the future real adapters.
 */
export function getMockTrendSignals(): TrendSignal[] {
  const now = new Date().toISOString();

  const s = (overrides: Partial<SignalEvent> & { label: string }): SignalEvent => ({
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
        s({
          label: "IG Reels: POV walk + captions",
          score: 70,
          source: "instagram",
          tags: ["instagram", "short-form", "reels", "pov"],
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
