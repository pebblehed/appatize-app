// src/lib/intelligence/momentScore.ts
//
// Canonical MomentScore contract (enterprise-grade, deterministic).
//
// Purpose:
// - Provide a stable, versioned, auditable scoring shape for moments/trends.
// - Supports HCIS: reproducible scoring + drift resistance via explicit versions.
// - This contract is safe to expose partially (Decision + Confidence + Rationale).
//
// Non-negotiables:
// - No time-now derived fields in the score itself.
// - Scoring components must be explainable and reproducible.
// - All changes to weights/thresholds must bump SCORE_MODEL_VERSION.

export type ConfidenceBand = "LOW" | "MODERATE" | "HIGH";
export type DecisionState = "ACT" | "WAIT" | "REFRESH";

/**
 * Each component is a bounded 0–100 score.
 * These are internal model components; UI may show only a subset.
 */
export type ScoreComponents = {
  density: number; // 0–100
  breadth: number; // 0–100
  velocity: number; // 0–100
  recurrence: number; // 0–100
  risk: number; // 0–100 (higher = riskier)
};

/**
 * Versioned scoring model constants.
 * If any weights/thresholds change, increment SCORE_MODEL_VERSION.
 */
export const SCORE_MODEL_VERSION = "moment-score-v1";

/**
 * Weights are internal and versioned.
 * They are included here to guarantee determinism and audit replay.
 */
export const SCORE_WEIGHTS_V1 = Object.freeze({
  density: 0.25,
  breadth: 0.25,
  velocity: 0.2,
  recurrence: 0.15,
  risk: 0.15, // subtractive weight
});

export const DECISION_THRESHOLDS_V1 = Object.freeze({
  act: {
    compositeMin: 70,
    breadthMin: 50,
    riskMax: 40,
  },
  wait: {
    compositeMin: 40, // 40–69 => WAIT
  },
  refresh: {
    compositeMax: 39, // <40 may be REFRESH if velocity is strong
    velocityMin: 50,
  },
});

export type DecisionRationale = {
  // Human-readable explanation (safe to show to users).
  summary: string;

  // Machine-auditable flags (safe for logs, not necessarily shown).
  flags: {
    singleSource?: boolean;
    lowBreadth?: boolean;
    lowDensity?: boolean;
    lowVelocity?: boolean;
    highRisk?: boolean;
    insufficientCorroboration?: boolean;
  };
};

export type MomentScore = {
  // Deterministic IDs + provenance are carried elsewhere (audit envelope).
  // This contract is purely scoring + decision output.

  scoreModelVersion: typeof SCORE_MODEL_VERSION;

  components: ScoreComponents;

  // Composite is deterministic from components + weights.
  // It is safe to store and audit, but not required to show in UI.
  composite: number; // 0–100

  confidence: ConfidenceBand;

  decision: {
    state: DecisionState;
    rationale: DecisionRationale;
  };

  // Captures internal guardrails applied at scoring time.
  // Must be stable and replayable.
  guards: {
    multiSourceTruthRequiredForAct: boolean;
    timeNowVolatilityExcluded: boolean;
  };
};
