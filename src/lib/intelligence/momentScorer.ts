// src/lib/intelligence/momentScorer.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Appatize Stage D — Deterministic MomentScorer
 * - Pure, deterministic, side-effect free
 * - No randomness, no time-based variance
 * - Produces an explainable score + breakdown + reasons
 *
 * Notes:
 * - Velocity is explicitly disabled unless reliable timestamps exist on the moment.
 * - This file is intentionally self-contained: no new deps, no scaffolding.
 */

export type MomentScoreGrade = "A" | "B" | "C" | "D" | "F";

export type MomentScoreBreakdown = {
  /** 0..100 */
  novelty: number;
  /** 0..100 */
  relevance: number;
  /** 0..100 */
  coherence: number;
  /** 0..100 */
  signalStrength: number;
  /** 0..100 (higher = more risk) */
  risk: number;
  /** 0..100 (disabled unless timestamps exist) */
  velocity: number;
};

export type MomentScore = {
  /** 0..100 final score (risk-adjusted) */
  score: number;
  grade: MomentScoreGrade;

  /**
   * Deterministic pass/fail gate. This does NOT replace qualifyMoment(),
   * but can be used as a supporting signal where needed.
   */
  pass: boolean;

  breakdown: MomentScoreBreakdown;

  /**
   * Deterministic explanations, ordered (stable).
   * Keep as short tokens for logs/UI.
   */
  reasons: string[];

  /**
   * Debug-friendly supporting values (stable keys, stable ordering).
   * Avoid putting raw external text here.
   */
  signals: Record<string, number | boolean | null>;
};

type ScorerOptions = {
  /**
   * Minimum final score to pass. Defaults to 70.
   * (This is a support threshold; the canonical firewall remains qualifyMoment()).
   */
  passThreshold?: number;

  /**
   * Weightings must sum to ~1.0. We normalize defensively.
   * risk is applied as a penalty, not part of the positive weighted sum.
   */
  weights?: Partial<{
    novelty: number;
    relevance: number;
    coherence: number;
    signalStrength: number;
    velocity: number;
    riskPenalty: number; // 0..1 multiplier on risk
  }>;

  /**
   * If true, velocity will be computed only when timestamps exist and are reliable.
   * Default true.
   */
  enableVelocityWhenTimestampsExist?: boolean;
};

const DEFAULTS = {
  passThreshold: 70,
  weights: {
    novelty: 0.22,
    relevance: 0.32,
    coherence: 0.22,
    signalStrength: 0.24,
    velocity: 0.0, // explicitly disabled by default
    riskPenalty: 0.55, // penalty multiplier applied to risk
  },
  enableVelocityWhenTimestampsExist: true,
} as const;

/**
 * Public API — scores a fused moment deterministically.
 */
export function scoreMoment(moment: unknown, options: ScorerOptions = {}): MomentScore {
  const opts = normalizeOptions(options);

  // Extract stable numeric signals from the incoming moment (shape-agnostic).
  const extracted = extractSignals(moment);

  // Compute core sub-scores (0..100). All deterministic.
  const novelty = scoreNovelty(extracted);
  const relevance = scoreRelevance(extracted);
  const coherence = scoreCoherence(extracted);
  const signalStrength = scoreSignalStrength(extracted);

  // Velocity: explicitly disabled unless timestamps exist and enabled by option.
  const velocityEnabled =
    opts.enableVelocityWhenTimestampsExist === true && extracted.hasReliableTimestamps === true;
  const velocity = velocityEnabled ? scoreVelocity(extracted) : 0;

  // Risk is a penalty score: higher risk reduces final score.
  const risk = scoreRisk(extracted);

  // Positive weighted sum.
  const positive =
    novelty * opts.weights.novelty +
    relevance * opts.weights.relevance +
    coherence * opts.weights.coherence +
    signalStrength * opts.weights.signalStrength +
    velocity * opts.weights.velocity;

  // Risk-adjusted score: subtract penalty (deterministic), clamp 0..100.
  const penalty = risk * opts.weights.riskPenalty;
  const finalScore = clamp01to100(positive - penalty);

  const grade = gradeFromScore(finalScore);

  const reasons = buildReasons({
    novelty,
    relevance,
    coherence,
    signalStrength,
    velocity,
    risk,
    velocityEnabled,
  });

  const pass = finalScore >= opts.passThreshold;

  return stableMomentScore({
    score: finalScore,
    grade,
    pass,
    breakdown: { novelty, relevance, coherence, signalStrength, risk, velocity },
    reasons,
    signals: extracted.publicSignals,
  });
}

/**
 * Backwards compatibility: if some callers import default.
 */
const momentScorer = { scoreMoment };
export default momentScorer;

/* =========================
   Deterministic primitives
   ========================= */

function normalizeOptions(options: ScorerOptions) {
  const passThreshold = isFiniteNumber(options.passThreshold)
    ? clamp(0, 100, options.passThreshold as number)
    : DEFAULTS.passThreshold;

  const w = { ...DEFAULTS.weights, ...(options.weights ?? {}) };

  // Normalize positive weights (novelty/relevance/coherence/signalStrength/velocity).
  const posSum = w.novelty + w.relevance + w.coherence + w.signalStrength + w.velocity;
  const safePosSum = posSum > 0 ? posSum : 1;

  const weights = {
    novelty: w.novelty / safePosSum,
    relevance: w.relevance / safePosSum,
    coherence: w.coherence / safePosSum,
    signalStrength: w.signalStrength / safePosSum,
    velocity: w.velocity / safePosSum,
    riskPenalty: clamp(0, 1, w.riskPenalty),
  };

  const enableVelocityWhenTimestampsExist =
    options.enableVelocityWhenTimestampsExist ?? DEFAULTS.enableVelocityWhenTimestampsExist;

  return { passThreshold, weights, enableVelocityWhenTimestampsExist };
}

function stableMomentScore(ms: MomentScore): MomentScore {
  // Ensure stable ordering of signals keys (deterministic output).
  const sortedSignals: Record<string, number | boolean | null> = {};
  for (const k of Object.keys(ms.signals).sort()) sortedSignals[k] = ms.signals[k];

  // Ensure stable ordering of reasons (already stable, but defensively enforce).
  const reasons = [...ms.reasons];

  return {
    score: ms.score,
    grade: ms.grade,
    pass: ms.pass,
    breakdown: ms.breakdown,
    reasons,
    signals: sortedSignals,
  };
}

function clamp(min: number, max: number, n: number) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function clamp01to100(n: number) {
  if (!isFiniteNumber(n)) return 0;
  return clamp(0, 100, n);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function gradeFromScore(score: number): MomentScoreGrade {
  // Deterministic grading bands.
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/* =========================
   Signal extraction (shape-agnostic)
   ========================= */

type ExtractedSignals = {
  // Normalized signals 0..1 where applicable
  uniqueness01: number;
  relevance01: number;
  coherence01: number;
  strength01: number;

  // Risk components 0..1
  spam01: number;
  toxicity01: number;
  manipulation01: number;
  uncertainty01: number;

  // Velocity support
  hasReliableTimestamps: boolean;
  velocity01: number;

  // Public stable signals (numbers / booleans only)
  publicSignals: Record<string, number | boolean | null>;
};

/**
 * Extracts signals from likely fused-moment shapes without assuming the schema.
 * Any missing fields degrade gracefully to conservative defaults.
 */
function extractSignals(moment: unknown): ExtractedSignals {
  const m = (moment ?? {}) as any;

  // Helper to read common candidate paths.
  const pickNumber01 = (candidates: any[], fallback: number) => {
    for (const v of candidates) {
      const n = coerceNumber(v);
      if (n === null) continue;
      // Some upstream sources might already be 0..100; detect and normalize.
      const normalized = n > 1.5 ? n / 100 : n;
      return clamp(0, 1, normalized);
    }
    return fallback;
  };

  const pickBool = (candidates: any[], fallback: boolean) => {
    for (const v of candidates) {
      if (typeof v === "boolean") return v;
    }
    return fallback;
  };

  // Uniqueness/novelty signals (0..1)
  const uniqueness01 = pickNumber01(
    [
      m?.score?.novelty,
      m?.scores?.novelty,
      m?.novelty,
      m?.features?.novelty,
      m?.signals?.novelty,
      m?.signals?.uniqueness,
      m?.features?.uniqueness,
    ],
    0.35
  );

  // Relevance signals (0..1)
  const relevance01 = pickNumber01(
    [
      m?.score?.relevance,
      m?.scores?.relevance,
      m?.relevance,
      m?.features?.relevance,
      m?.signals?.relevance,
      m?.alignment?.relevance,
    ],
    0.4
  );

  // Coherence signals (0..1)
  const coherence01 = pickNumber01(
    [
      m?.score?.coherence,
      m?.scores?.coherence,
      m?.coherence,
      m?.features?.coherence,
      m?.signals?.coherence,
      m?.quality?.coherence,
    ],
    0.45
  );

  // Signal strength (0..1) (how strong / corroborated / multi-source)
  const strength01 = pickNumber01(
    [
      m?.score?.signalStrength,
      m?.scores?.signalStrength,
      m?.signalStrength,
      m?.features?.signalStrength,
      m?.signals?.strength,
      m?.signals?.confidence,
      m?.confidence,
      m?.quality?.confidence,
    ],
    0.4
  );

  // Risk components (0..1). Conservative defaults.
  const spam01 = pickNumber01(
    [m?.risk?.spam, m?.risks?.spam, m?.signals?.spam, m?.quality?.spam],
    0.15
  );
  const toxicity01 = pickNumber01(
    [m?.risk?.toxicity, m?.risks?.toxicity, m?.signals?.toxicity, m?.quality?.toxicity],
    0.05
  );
  const manipulation01 = pickNumber01(
    [m?.risk?.manipulation, m?.risks?.manipulation, m?.signals?.manipulation],
    0.1
  );
  const uncertainty01 = pickNumber01(
    [
      m?.risk?.uncertainty,
      m?.risks?.uncertainty,
      m?.signals?.uncertainty,
      // Sometimes "confidence" exists instead; uncertainty = 1 - confidence
      invert01FromCandidate(m?.confidence),
      invert01FromCandidate(m?.signals?.confidence),
      invert01FromCandidate(m?.quality?.confidence),
    ],
    0.35
  );

  // Timestamps: determine if we can compute velocity deterministically.
  const hasReliableTimestamps = pickBool(
    [m?.timestamps?.reliable, m?.meta?.timestampsReliable, m?.time?.reliable],
    false
  );

  // Optional explicit velocity signal (0..1). If absent, conservative default.
  const velocity01 = pickNumber01(
    [m?.signals?.velocity, m?.features?.velocity, m?.velocity, m?.score?.velocity],
    0
  );

  const publicSignals: Record<string, number | boolean | null> = {
    uniqueness01,
    relevance01,
    coherence01,
    strength01,
    spam01,
    toxicity01,
    manipulation01,
    uncertainty01,
    hasReliableTimestamps,
    velocity01: hasReliableTimestamps ? velocity01 : 0,
  };

  return {
    uniqueness01,
    relevance01,
    coherence01,
    strength01,
    spam01,
    toxicity01,
    manipulation01,
    uncertainty01,
    hasReliableTimestamps,
    velocity01: hasReliableTimestamps ? velocity01 : 0,
    publicSignals,
  };
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function invert01FromCandidate(v: unknown): number | null {
  const n = coerceNumber(v);
  if (n === null) return null;
  const normalized = n > 1.5 ? n / 100 : n;
  const c01 = clamp(0, 1, normalized);
  return clamp(0, 1, 1 - c01);
}

/* =========================
   Scoring functions (0..100)
   ========================= */

function scoreNovelty(s: ExtractedSignals): number {
  // Reward uniqueness with slight lift if coherence is also decent.
  const base = s.uniqueness01;
  const lift = 0.08 * s.coherence01;
  return clamp01to100((base + lift) * 100);
}

function scoreRelevance(s: ExtractedSignals): number {
  // Relevance is primary: penalize if uncertainty is high.
  const base = s.relevance01;
  const uncertaintyPenalty = 0.18 * s.uncertainty01;
  return clamp01to100((base - uncertaintyPenalty) * 100);
}

function scoreCoherence(s: ExtractedSignals): number {
  // Coherence must be strong for downstream explainability.
  // Penalize if manipulation risk is high.
  const base = s.coherence01;
  const manipulationPenalty = 0.12 * s.manipulation01;
  return clamp01to100((base - manipulationPenalty) * 100);
}

function scoreSignalStrength(s: ExtractedSignals): number {
  // Strength is about multi-source confidence; penalize if spam risk is high.
  const base = s.strength01;
  const spamPenalty = 0.15 * s.spam01;
  return clamp01to100((base - spamPenalty) * 100);
}

function scoreVelocity(s: ExtractedSignals): number {
  // Velocity is explicitly disabled unless timestamps exist.
  // When enabled, use provided velocity01 only (no implicit "now").
  return clamp01to100(s.velocity01 * 100);
}

function scoreRisk(s: ExtractedSignals): number {
  // Deterministic risk aggregate (0..100). Higher is worse.
  // Weighted to treat toxicity/manipulation as heavier than spam.
  const risk01 =
    0.25 * s.spam01 + 0.3 * s.toxicity01 + 0.25 * s.manipulation01 + 0.2 * s.uncertainty01;

  return clamp01to100(risk01 * 100);
}

/* =========================
   Reasons (stable, explainable)
   ========================= */

function buildReasons(input: {
  novelty: number;
  relevance: number;
  coherence: number;
  signalStrength: number;
  velocity: number;
  risk: number;
  velocityEnabled: boolean;
}): string[] {
  const reasons: string[] = [];

  // Positive reasons (ordered)
  if (input.relevance >= 80) reasons.push("RELEVANCE_HIGH");
  if (input.coherence >= 80) reasons.push("COHERENCE_HIGH");
  if (input.signalStrength >= 80) reasons.push("SIGNAL_STRONG");
  if (input.novelty >= 80) reasons.push("NOVELTY_HIGH");

  // Velocity reason (explicit)
  if (!input.velocityEnabled) reasons.push("VELOCITY_DISABLED");
  else if (input.velocity >= 70) reasons.push("VELOCITY_HIGH");

  // Risk reasons (ordered)
  if (input.risk >= 70) reasons.push("RISK_HIGH");
  else if (input.risk >= 45) reasons.push("RISK_MED");

  // Gaps (ordered)
  if (input.relevance < 55) reasons.push("RELEVANCE_LOW");
  if (input.coherence < 55) reasons.push("COHERENCE_LOW");
  if (input.signalStrength < 55) reasons.push("SIGNAL_WEAK");
  if (input.novelty < 45) reasons.push("NOVELTY_LOW");

  // Ensure stable uniqueness and deterministic order already enforced by push order.
  return reasons;
}
