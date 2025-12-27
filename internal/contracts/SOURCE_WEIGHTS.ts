// /internal/contracts/SOURCE_WEIGHTS.ts
//
// Stage 6.4 — Source Confidence Weights
// Base weights are *prior belief* about signal reliability for "moment detection".
// They do NOT create a moment on their own. Convergence still requires agreement.
//
// Rules:
// - Keep simple + deterministic
// - Adjustable later (without touching convergence logic)

export type SourceKey =
  | "hn"
  | "reddit"
  | "rss"
  | "x"
  | "tiktok"
  | "youtube"
  | "unknown";

export type SourceWeight = {
  source: SourceKey;
  // Base confidence weight (0..1). Higher = more trusted prior for signal-to-moment usefulness.
  base: number;
  // Optional penalty if a source is known noisy at the item level
  noisePenalty?: number; // 0..0.5 typically
};

export const SOURCE_WEIGHTS: Record<SourceKey, SourceWeight> = {
  hn: { source: "hn", base: 0.78, noisePenalty: 0.05 },
  reddit: { source: "reddit", base: 0.70, noisePenalty: 0.08 },
  rss: { source: "rss", base: 0.74, noisePenalty: 0.06 },
  x: { source: "x", base: 0.60, noisePenalty: 0.12 },
  tiktok: { source: "tiktok", base: 0.55, noisePenalty: 0.15 },
  youtube: { source: "youtube", base: 0.62, noisePenalty: 0.12 },
  unknown: { source: "unknown", base: 0.50, noisePenalty: 0.10 },
};
