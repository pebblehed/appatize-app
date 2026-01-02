// src/lib/intelligence/actionHint.ts
//
// Stage 3.9 — Minimal action hint (deterministic, read-only)
// Inputs: decisionState, signalStrength, confidenceTrajectory
// Output: one short UI hint sentence (max 1 sentence)
// Rules: no LLM, no marketing language, no extra steering beyond evidence.

export type DecisionState = "ACT" | "WAIT" | "REFRESH";
export type SignalStrength = "WEAK" | "MODERATE" | "STRONG";
export type ConfidenceTrajectory = "RISING" | "STABLE" | "WEAKENING";

type Inputs = {
  decisionState: DecisionState;
  signalStrength: SignalStrength;
  confidenceTrajectory: ConfidenceTrajectory;
};

export function getMinimalActionHint({
  decisionState,
  signalStrength,
  confidenceTrajectory,
}: Inputs): string {
  // Guardrails: never hype. Keep it short and operational.

  if (decisionState === "ACT") {
    // Evidence says move. Keep language minimal.
    if (signalStrength === "STRONG" && confidenceTrajectory === "RISING") {
      return "Worth turning into a brief now.";
    }
    return "Worth turning into a brief now.";
  }

  if (decisionState === "WAIT") {
    // Evidence says monitor.
    if (confidenceTrajectory === "RISING") return "Track for another signal cycle.";
    if (confidenceTrajectory === "WEAKENING") return "Track for another signal cycle.";
    return "Track for another signal cycle.";
  }

  // REFRESH
  if (signalStrength === "WEAK" || confidenceTrajectory === "WEAKENING") {
    return "Recheck shortly for movement.";
  }
  return "Recheck shortly for movement.";
}
