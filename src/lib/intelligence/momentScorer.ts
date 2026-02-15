// src/lib/intelligence/momentScorer.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Appatize Stage D — Deterministic MomentScorer (contract-aligned)
 *
 * Contract source:
 * - src/lib/intelligence/momentScore.ts
 *
 * Non-negotiables:
 * - Deterministic: no Date.now, no randomness, no I/O
 * - Composite derived only from components + SCORE_WEIGHTS_V1 (risk subtractive)
 * - Velocity must be 0 unless reliable timestamps exist upstream
 * - Decision derived only from DECISION_THRESHOLDS_V1
 * - Guards must be stable and replayable
 */

import {
  SCORE_MODEL_VERSION,
  SCORE_WEIGHTS_V1,
  DECISION_THRESHOLDS_V1,
  type MomentScore,
  type ScoreComponents,
  type ConfidenceBand,
  type DecisionState,
  type DecisionRationale,
} from "./momentScore";

type ScorerOptions = {
  /**
   * Override of decision thresholds is not allowed here (contract-controlled).
   * This exists only to support future deterministic feature flags if needed.
   */
  enableVelocityWhenTimestampsExist?: boolean;
};

const DEFAULTS: Required<ScorerOptions> = {
  enableVelocityWhenTimestampsExist: true,
};

export function scoreMoment(moment: unknown, options: ScorerOptions = {}): MomentScore {
  const opts = { ...DEFAULTS, ...options };

  const extracted = extractSignals(moment);

  // Components (0..100). Deterministic, conservative fallbacks.
  const density = scoreDensity(extracted);
  const breadth = scoreBreadth(extracted);

  // Velocity: explicitly disabled unless reliable timestamps exist upstream.
  const velocityEnabled = opts.enableVelocityWhenTimestampsExist && extracted.hasReliableTimestamps;
  const velocity = velocityEnabled ? scoreVelocity(extracted) : 0;

  const recurrence = scoreRecurrence(extracted);
  const risk = scoreRisk(extracted);

  const components: ScoreComponents = {
    density,
    breadth,
    velocity,
    recurrence,
    risk,
  };

  const composite = computeComposite(components);

  const confidence = computeConfidence(components, extracted);

  const decision = computeDecision(components, composite);

  return {
    scoreModelVersion: SCORE_MODEL_VERSION,
    components,
    composite,
    confidence,
    decision,
    guards: {
      multiSourceTruthRequiredForAct: true,
      timeNowVolatilityExcluded: true,
    },
  };
}

/**
 * Backwards compatibility: if some callers import default.
 */
const momentScorer = { scoreMoment };
export default momentScorer;

/* =========================
   Deterministic primitives
   ========================= */

function clamp(min: number, max: number, n: number) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function clamp01to100(n: number) {
  if (!Number.isFinite(n)) return 0;
  return clamp(0, 100, n);
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickNumber01(candidates: unknown[], fallback01: number): number {
  for (const v of candidates) {
    const n = coerceNumber(v);
    if (n === null) continue;
    // Normalize if upstream uses 0..100.
    const normalized = n > 1.5 ? n / 100 : n;
    return clamp(0, 1, normalized);
  }
  return clamp(0, 1, fallback01);
}

function pickBool(candidates: unknown[], fallback: boolean): boolean {
  for (const v of candidates) if (typeof v === "boolean") return v;
  return fallback;
}

/* =========================
   Contract composite logic
   ========================= */

function computeComposite(c: ScoreComponents): number {
  // Composite is deterministic from components + weights.
  // risk is subtractive in the contract.
  const positive =
    c.density * SCORE_WEIGHTS_V1.density +
    c.breadth * SCORE_WEIGHTS_V1.breadth +
    c.velocity * SCORE_WEIGHTS_V1.velocity +
    c.recurrence * SCORE_WEIGHTS_V1.recurrence;

  const penalty = c.risk * SCORE_WEIGHTS_V1.risk;

  return clamp01to100(positive - penalty);
}

/* =========================
   Decision + confidence (contract thresholds)
   ========================= */

function computeDecision(
  c: ScoreComponents,
  composite: number
): { state: DecisionState; rationale: DecisionRationale } {
  // ACT gate (strict)
  const act = DECISION_THRESHOLDS_V1.act;
  const wait = DECISION_THRESHOLDS_V1.wait;
  const refresh = DECISION_THRESHOLDS_V1.refresh;

  const flags = buildRationaleFlags(c);

  // ACT requires multi-source truth (enforced via breadth proxy) and risk ceiling.
  const canAct =
    composite >= act.compositeMin && c.breadth >= act.breadthMin && c.risk <= act.riskMax;

  if (canAct) {
    return {
      state: "ACT",
      rationale: {
        summary: "Composite meets ACT threshold with sufficient breadth and acceptable risk.",
        flags,
      },
    };
  }

  // WAIT band
  if (composite >= wait.compositeMin) {
    return {
      state: "WAIT",
      rationale: {
        summary: "Composite is promising but does not satisfy ACT guardrails (breadth/risk).",
        flags,
      },
    };
  }

  // REFRESH condition: low composite, but velocity is strong (when enabled upstream).
  const canRefresh = composite <= refresh.compositeMax && c.velocity >= refresh.velocityMin;

  if (canRefresh) {
    return {
      state: "REFRESH",
      rationale: {
        summary: "Composite is low but velocity is strong; refresh signals and re-evaluate.",
        flags,
      },
    };
  }

  // Default: WAIT (conservative)
  return {
    state: "WAIT",
    rationale: {
      summary:
        "Insufficient composite strength for ACT; monitor for corroboration or improved signals.",
      flags,
    },
  };
}

function computeConfidence(c: ScoreComponents, extracted: ExtractedSignals): ConfidenceBand {
  /**
   * Deterministic confidence heuristic.
   * High confidence requires:
   * - strong density and breadth
   * - low risk
   * - low uncertainty proxy (extracted.uncertainty01)
   */
  const uncertaintyScore = clamp01to100((1 - extracted.uncertainty01) * 100);

  const high =
    c.density >= 70 &&
    c.breadth >= 60 &&
    c.risk <= 30 &&
    uncertaintyScore >= 70 &&
    extracted.multiSource === true;

  if (high) return "HIGH";

  const moderate = c.density >= 45 && c.breadth >= 35 && c.risk <= 55 && uncertaintyScore >= 45;

  if (moderate) return "MODERATE";

  return "LOW";
}

function buildRationaleFlags(c: ScoreComponents): DecisionRationale["flags"] {
  return {
    singleSource: c.breadth < DECISION_THRESHOLDS_V1.act.breadthMin,
    lowBreadth: c.breadth < 50,
    lowDensity: c.density < 50,
    lowVelocity: c.velocity < 50,
    highRisk: c.risk > DECISION_THRESHOLDS_V1.act.riskMax,
    insufficientCorroboration: c.breadth < DECISION_THRESHOLDS_V1.act.breadthMin,
  };
}

/* =========================
   Signal extraction (shape-agnostic, deterministic)
   ========================= */

type ExtractedSignals = {
  // 0..1 signals
  density01: number;
  breadth01: number;
  recurrence01: number;
  risk01: number;
  velocity01: number;

  // Supporting risk components (0..1) (used to compute uncertainty proxy)
  uncertainty01: number;

  // Guard inputs
  hasReliableTimestamps: boolean;
  multiSource: boolean;
};

function extractSignals(moment: unknown): ExtractedSignals {
  const m = (moment ?? {}) as any;

  /**
   * We intentionally support several likely shapes without assuming schema:
   * - moment.components.*
   * - moment.score/components/scores/features/signals.*
   *
   * Conservative defaults prevent accidental over-scoring.
   */

  const density01 = pickNumber01(
    [
      m?.components?.density,
      m?.score?.density,
      m?.scores?.density,
      m?.signals?.density,
      m?.features?.density,
      m?.quality?.density,
    ],
    0.35
  );

  const breadth01 = pickNumber01(
    [
      m?.components?.breadth,
      m?.score?.breadth,
      m?.scores?.breadth,
      m?.signals?.breadth,
      m?.features?.breadth,
      m?.quality?.breadth,
      // Sometimes breadth is approximated by sourceCount normalization elsewhere
      normalizeCount01(m?.sourceCount),
      normalizeCount01(m?.sources?.length),
    ],
    0.3
  );

  const recurrence01 = pickNumber01(
    [
      m?.components?.recurrence,
      m?.score?.recurrence,
      m?.scores?.recurrence,
      m?.signals?.recurrence,
      m?.features?.recurrence,
      m?.quality?.recurrence,
    ],
    0.25
  );

  // Risk: if upstream provides 0..1 or 0..100, normalize.
  const risk01 = pickNumber01(
    [
      m?.components?.risk,
      m?.risk?.score,
      m?.score?.risk,
      m?.scores?.risk,
      m?.signals?.risk,
      m?.quality?.risk,
    ],
    0.2
  );

  const hasReliableTimestamps = pickBool(
    [m?.timestamps?.reliable, m?.meta?.timestampsReliable, m?.time?.reliable],
    false
  );

  // Velocity: only used if hasReliableTimestamps is true.
  const velocity01Raw = pickNumber01(
    [
      m?.components?.velocity,
      m?.signals?.velocity,
      m?.features?.velocity,
      m?.score?.velocity,
      m?.scores?.velocity,
    ],
    0
  );
  const velocity01 = hasReliableTimestamps ? velocity01Raw : 0;

  // Multi-source proxy (for confidence + ACT rationale). Deterministic.
  const multiSource =
    pickBool([m?.multiSource, m?.signals?.multiSource, m?.meta?.multiSource], false) ||
    (coerceNumber(m?.sourceCount) ?? 0) >= 2 ||
    (Array.isArray(m?.sources) && m.sources.length >= 2);

  // Uncertainty proxy: if confidence is provided, invert it. Else default conservative.
  const confidence01 = pickNumber01(
    [m?.confidence, m?.signals?.confidence, m?.quality?.confidence],
    0.55
  );
  const uncertainty01 = clamp(0, 1, 1 - confidence01);

  return {
    density01,
    breadth01,
    recurrence01,
    risk01,
    velocity01,
    uncertainty01,
    hasReliableTimestamps,
    multiSource,
  };
}

function normalizeCount01(v: unknown): number | null {
  const n = coerceNumber(v);
  if (n === null) return null;
  // Saturating normalization: 0..5 => 0..1
  const clamped = clamp(0, 5, n);
  return clamped / 5;
}

/* =========================
   Component scoring (0..100)
   ========================= */

function scoreDensity(s: ExtractedSignals): number {
  // Density: how concentrated / strong the signal is.
  return clamp01to100(s.density01 * 100);
}

function scoreBreadth(s: ExtractedSignals): number {
  // Breadth: corroboration across sources/communities.
  return clamp01to100(s.breadth01 * 100);
}

function scoreVelocity(s: ExtractedSignals): number {
  // Velocity: ONLY uses provided velocity signal, never "time-now".
  return clamp01to100(s.velocity01 * 100);
}

function scoreRecurrence(s: ExtractedSignals): number {
  // Recurrence: repeated appearance over time windows (as provided).
  return clamp01to100(s.recurrence01 * 100);
}

function scoreRisk(s: ExtractedSignals): number {
  // Risk: higher is riskier.
  return clamp01to100(s.risk01 * 100);
}
