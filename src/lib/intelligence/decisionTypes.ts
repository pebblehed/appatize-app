// src/lib/intelligence/decisionTypes.ts
//
// Stage D — Decision Surfacing types (stable contract)
//
// Stage 3.4 adds OPTIONAL evidence surfacing fields.
// These are read-only and deterministic, and MUST NOT break callers.

export type DecisionState = "ACT" | "WAIT" | "REFRESH";

export type ConfidenceTrajectory = "ACCELERATING" | "STABLE" | "WEAKENING" | "VOLATILE";

export type SignalStrength = "WEAK" | "MODERATE" | "STRONG";

/**
 * Stage 3.4 — Evidence Surface (read-only)
 * Deterministic primitives + simple derived metrics.
 * Optional so older routes/UI won’t break.
 */
export type EvidenceSurface = {
  signalCount: number;
  sourceCount: number;

  // ISO timestamps (if we have them)
  firstSeenAt?: string;
  lastConfirmedAt?: string;

  // Derived metrics (deterministic)
  ageHours?: number;       // hours since firstSeenAt
  recencyMins?: number;    // minutes since lastConfirmedAt
  velocityPerHour?: number; // signalCount / ageHours (guarded)
};

export type DecisionSurface = {
  decisionState: DecisionState;
  confidenceTrajectory: ConfidenceTrajectory;
  signalStrength: SignalStrength;
  decisionRationale: string;

  // Stage 3.4 (optional)
  evidence?: EvidenceSurface;
};
