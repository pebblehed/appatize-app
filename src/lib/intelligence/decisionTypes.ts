// src/lib/intelligence/decisionTypes.ts
//
// Decision intelligence shared types
// Stage D.6+
// Pure contracts — no logic

export type DecisionState = "ACT" | "WAIT" | "REFRESH";

export type ConfidenceTrajectory =
  | "ACCELERATING"
  | "STABLE"
  | "WEAKENING"
  | "VOLATILE";

export type SignalStrength = "WEAK" | "MODERATE" | "STRONG";

export type DecisionSurface = {
  decisionState: DecisionState;
  confidenceTrajectory: ConfidenceTrajectory;
  signalStrength: SignalStrength;
  decisionRationale: string;
};
