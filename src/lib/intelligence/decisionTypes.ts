// src/lib/intelligence/decisionTypes.ts
//
// Stage D.6 — Decision Surfacing Types
// These are strict enums to prevent UI/API drift.

export type DecisionState = "ACT" | "WAIT" | "REFRESH";
export type ConfidenceTrajectory = "RISING" | "STABLE" | "WEAKENING";
export type SignalStrength = "STRONG" | "MODERATE" | "WEAK";

export type DecisionSurface = {
  decisionState: DecisionState;
  confidenceTrajectory: ConfidenceTrajectory;
  signalStrength: SignalStrength;
  decisionRationale: string; // short, human-readable sentence
  decisionNextStep: string;  // imperative next action hint
};
