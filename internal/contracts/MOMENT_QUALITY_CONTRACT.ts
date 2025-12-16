/**
 * Moment Quality Contract — Stage D.3
 * ----------------------------------
 * This contract defines the deterministic scoring + qualification shapes that
 * every "moment" must pass BEFORE it can be promoted to the Trend Surface.
 *
 * Purpose:
 * - Prevent junk / keyword soup from surfacing
 * - Enforce multi-signal evidence
 * - Prefer inflection (early) over volume (late)
 * - Make quality testable + regressions catchable
 *
 * Note:
 * - This file is intentionally pure (types + constants + helpers).
 * - No model calls. No side effects.
 */

export type MomentMaturity = "emerging" | "forming" | "established" | "expired";

/**
 * Normalized quality score components (0..1 unless stated otherwise).
 */
export type MomentQualityScore = {
  /**
   * Evidence quality:
   * - rewards independent sources
   * - penalizes single-source repetition
   */
  signalDensity: number; // 0..1

  /**
   * Inflection quality:
   * - measures acceleration (not raw volume)
   * - may be mapped to 0..1 by implementation
   */
  velocity: number; // 0..1 (normalized in implementation)

  /**
   * Narrative coherence:
   * - rewards clusters that compress into a clean "what's happening" story
   * - penalizes unrelated term soup
   */
  narrativeCoherence: number; // 0..1

  /**
   * Human legibility:
   * - can a strategist understand this quickly?
   * - penalizes jargon-only or vague abstractions
   */
  culturalLegibility: number; // 0..1

  /**
   * Weighted overall score (0..1).
   * Must be computed using MomentQualityWeights.
   */
  overall: number; // 0..1
};

/**
 * Explainability payload (stored internally; UI can surface later).
 * Keep this minimal and deterministic — no prose required here.
 */
export type MomentExplainability = {
  /**
   * Where did the signals come from?
   * Example values: "hn", "reddit", "fusion", "x", etc.
   */
  uniqueSources: string[];

  /**
   * How many distinct signal items were observed in the cluster?
   */
  totalSignals: number;

  /**
   * First-seen timestamp (ISO string) for provenance.
   */
  firstSeenAt?: string;

  /**
   * Optional: if deduplication collapses multiple moments into one,
   * track lineage ids for auditability.
   */
  collapsedFromIds?: string[];
};

/**
 * Full qualification result returned by the quality firewall.
 */
export type MomentQualification = {
  pass: boolean;
  score: MomentQualityScore;

  /**
   * Reasons are short, deterministic flags suitable for logs/tests.
   * Example: "FAIL_SINGLE_SOURCE", "FAIL_LOW_COHERENCE", etc.
   */
  reasons: string[];

  /**
   * Internal-only maturity classification.
   * Computed after pass/fail (or even when failing, if you want).
   */
  maturity?: MomentMaturity;

  /**
   * Internal explainability payload for Proof & Provenance.
   */
  explain?: MomentExplainability;
};

/**
 * Weights for the overall score.
 * Must sum to 1.0 (enforced by helper).
 */
export type MomentQualityWeights = {
  signalDensity: number;
  velocity: number;
  narrativeCoherence: number;
  culturalLegibility: number;
};

/**
 * Hard thresholds for the quality gate.
 * These defaults are conservative — we can tune later, but keep them stable
 * to avoid moving goalposts while hardening.
 */
export type MomentQualityThresholds = {
  /**
   * Minimum overall score to pass.
   */
  minOverall: number;

  /**
   * Minimum individual component scores to avoid a single weak pillar
   * sneaking through on the strength of other components.
   */
  minSignalDensity: number;
  minVelocity: number;
  minNarrativeCoherence: number;
  minCulturalLegibility: number;

  /**
   * Evidence rules.
   */
  minUniqueSources: number;
  minTotalSignals: number;
};

/**
 * Default weights (locked for D.3).
 * Rationale:
 * - Narrative + evidence are king (we're building moment quality, not hype).
 * - Velocity matters, but not at the cost of coherence.
 * - Legibility ensures "strategist sanity."
 */
export const DEFAULT_MOMENT_QUALITY_WEIGHTS: MomentQualityWeights = {
  signalDensity: 0.28,
  velocity: 0.22,
  narrativeCoherence: 0.28,
  culturalLegibility: 0.22,
};

/**
 * Default thresholds (locked for D.3).
 * Rationale:
 * - Require multi-source validation where possible.
 * - Require coherence + legibility above "meh".
 * - Avoid promoting low-signal clusters even if velocity spikes.
 */
export const DEFAULT_MOMENT_QUALITY_THRESHOLDS: MomentQualityThresholds = {
  minOverall: 0.68,

  minSignalDensity: 0.55,
  minVelocity: 0.45,
  minNarrativeCoherence: 0.55,
  minCulturalLegibility: 0.50,

  minUniqueSources: 2,
  minTotalSignals: 4,
};

/**
 * Utility: safe clamp for normalized values.
 */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/**
 * Utility: compute weighted overall score from components.
 * - All components are clamped to 0..1
 * - Weights should sum to 1.0 (we guard lightly)
 */
export function computeMomentOverallScore(
  components: Omit<MomentQualityScore, "overall">,
  weights: MomentQualityWeights = DEFAULT_MOMENT_QUALITY_WEIGHTS
): number {
  const wSum =
    weights.signalDensity +
    weights.velocity +
    weights.narrativeCoherence +
    weights.culturalLegibility;

  // If someone misconfigures weights, normalize to protect stability.
  const safe = (w: number) => (wSum > 0 ? w / wSum : 0);

  const score =
    clamp01(components.signalDensity) * safe(weights.signalDensity) +
    clamp01(components.velocity) * safe(weights.velocity) +
    clamp01(components.narrativeCoherence) * safe(weights.narrativeCoherence) +
    clamp01(components.culturalLegibility) * safe(weights.culturalLegibility);

  return clamp01(score);
}

/**
 * Utility: generate deterministic pass/fail reasons from a score + evidence.
 * Keep this strict and boring — it powers regression tests.
 */
export function evaluateMomentAgainstThresholds(args: {
  score: MomentQualityScore;
  thresholds?: MomentQualityThresholds;
  uniqueSourcesCount: number;
  totalSignals: number;
}): { pass: boolean; reasons: string[] } {
  const t = args.thresholds ?? DEFAULT_MOMENT_QUALITY_THRESHOLDS;
  const reasons: string[] = [];

  if (args.uniqueSourcesCount < t.minUniqueSources) reasons.push("FAIL_SINGLE_SOURCE");
  if (args.totalSignals < t.minTotalSignals) reasons.push("FAIL_LOW_SIGNAL_COUNT");

  if (args.score.signalDensity < t.minSignalDensity) reasons.push("FAIL_LOW_SIGNAL_DENSITY");
  if (args.score.velocity < t.minVelocity) reasons.push("FAIL_LOW_VELOCITY");
  if (args.score.narrativeCoherence < t.minNarrativeCoherence) reasons.push("FAIL_LOW_COHERENCE");
  if (args.score.culturalLegibility < t.minCulturalLegibility) reasons.push("FAIL_LOW_LEGIBILITY");

  if (args.score.overall < t.minOverall) reasons.push("FAIL_LOW_OVERALL");

  return { pass: reasons.length === 0, reasons };
}
