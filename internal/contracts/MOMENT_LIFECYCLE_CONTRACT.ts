// internal/contracts/MOMENT_LIFECYCLE_CONTRACT.ts
//
// Stage D.5 — Moment Lifecycle, Decay & Drift Control
//
// Purpose:
// - Describe moment "health" truthfully using evidence-based scoring.
// - Never time-expire for theatre.
// - Provide explainable reasons to users.
// - Enable hard refusal when a moment is no longer valid.
//
// Notes:
// - Time can be used ONLY as a window for measuring evidence.
// - No rule may invalidate purely because of age.

export type MomentLifecycleState =
  | "VALID"
  | "WEAKENING"
  | "DRIFTING"
  | "INVALID";

export type MomentInvalidReason =
  | "INSUFFICIENT_SIGNAL"
  | "IDENTITY_DRIFT"
  | "MISSING_CANONICAL_IDENTITY"
  | "MISSING_SIGNAL_CONTEXT";

/**
 * Lifecycle thresholds are explicit and deterministic.
 * - weaken/drift are warnings (still usable).
 * - min thresholds trigger hard refusal.
 */
export type MomentLifecycleThresholds = {
  // Signal integrity
  sis_min: number; // hard refuse if below
  sis_weaken_warn: number; // WEAKENING if below (but >= sis_min)

  // Identity continuity
  ics_min: number; // hard refuse if below
  ics_drift_warn: number; // DRIFTING if below (but >= ics_min)
};

export type MomentLifecycleScores = {
  SIS: number; // signal integrity [0..1]
  ICS: number; // identity continuity [0..1]
};

export type MomentLifecycleExplain = {
  signal: string[]; // plain-English bullets
  identity: string[]; // plain-English bullets
};

/**
 * Lifecycle result is always safe + explainable.
 * `invalidReason` is present only when state is INVALID.
 */
export type MomentLifecycleResult = {
  state: MomentLifecycleState;
  scores: MomentLifecycleScores;
  explain: MomentLifecycleExplain;
  evaluatedAtISO: string;
  invalidReason?: MomentInvalidReason;
};

/**
 * Default thresholds: conservative but usable.
 * Tune later with fixtures/goldens — never change logic without tests.
 */
export const DEFAULT_MOMENT_LIFECYCLE_THRESHOLDS: MomentLifecycleThresholds = {
  sis_min: 0.22,
  sis_weaken_warn: 0.45,
  ics_min: 0.45,
  ics_drift_warn: 0.65,
};
