// src/lib/intelligence/decisionSurfacing.ts
//
// Stage D.6 — Decision Surfacing (enforced)
// Purpose: take existing moment evidence (no new intelligence)
// and surface a safe decision state.
// Hard rules:
// - Never 500 (caller should fallback if needed)
// - Never allow ACT with WEAK
// - Never allow ACT with WEAKENING
// - Enforce compatibility table and downgrade conservatively

import type {
  DecisionSurface,
  DecisionState,
  ConfidenceTrajectory,
  SignalStrength,
} from "./decisionTypes";

type Inputs = {
  // Keep this intentionally minimal and explainable.
  // You can evolve later without changing the decision contract.
  signalCount: number;
  sourceCount: number;
  firstSeenAt?: string;
  lastConfirmedAt?: string;
  // Optional: your existing moment quality score if you have one
  qualityScore?: number; // 0..1
  // Optional: lightweight trend delta if you track it
  recentDelta?: number; // -1..+1
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/**
 * Derive a conservative signal strength from evidence.
 * This is NOT “new intelligence”; it’s a deterministic label.
 */
function deriveSignalStrength(i: Inputs): SignalStrength {
  const signals = i.signalCount ?? 0;
  const sources = i.sourceCount ?? 0;

  // Conservative heuristics (tunable later)
  if (signals >= 18 && sources >= 2) return "STRONG";
  if (signals >= 8 && sources >= 1) return "MODERATE";
  return "WEAK";
}

/**
 * Derive trajectory direction without overfitting.
 * If you don’t have deltas yet, default to STABLE.
 */
function deriveTrajectory(i: Inputs): ConfidenceTrajectory {
  const d = typeof i.recentDelta === "number" ? i.recentDelta : 0;

  if (d >= 0.15) return "RISING";
  if (d <= -0.15) return "WEAKENING";
  return "STABLE";
}

/**
 * Base decision from strength + (optional) quality.
 */
function deriveDecisionState(
  strength: SignalStrength,
  trajectory: ConfidenceTrajectory,
  qualityScore?: number
): DecisionState {
  const q = typeof qualityScore === "number" ? clamp01(qualityScore) : undefined;

  // Core conservative rules:
  if (strength === "WEAK") return "REFRESH";

  // If we have quality, use it as a further gate (but never required)
  if (typeof q === "number") {
    if (q >= 0.78 && strength === "STRONG" && (trajectory === "RISING" || trajectory === "STABLE")) {
      return "ACT";
    }
    if (q >= 0.55) return "WAIT";
    return "REFRESH";
  }

  // Without quality score: do not overclaim ACT.
  // Reserve ACT for STRONG + RISING as the safest default.
  if (strength === "STRONG" && trajectory === "RISING") return "ACT";
  return "WAIT";
}

/**
 * Enforce the compatibility table and WEAK guardrails.
 * Downgrade to REFRESH/WEAKENING if invalid.
 */
function enforce(surface: DecisionSurface): DecisionSurface {
  // Rule: WEAK can never be ACT
  if (surface.signalStrength === "WEAK" && surface.decisionState === "ACT") {
    return {
      ...surface,
      decisionState: "REFRESH",
      confidenceTrajectory: "WEAKENING",
      decisionRationale: "Insufficient convergence to justify action responsibly.",
      decisionNextStep: "Refresh later; do not force narrative.",
    };
  }

  // Rule: ACT cannot be WEAKENING
  if (surface.decisionState === "ACT" && surface.confidenceTrajectory === "WEAKENING") {
    return {
      ...surface,
      decisionState: "REFRESH",
      confidenceTrajectory: "WEAKENING",
      decisionRationale: "Signal coherence is weakening; action is not justified now.",
      decisionNextStep: "Pause and refresh; reassess once reconfirmed.",
    };
  }

  // Compatibility table enforcement
  const allowed: Record<DecisionState, ConfidenceTrajectory[]> = {
    ACT: ["RISING", "STABLE"],
    WAIT: ["RISING", "STABLE", "WEAKENING"],
    REFRESH: ["STABLE", "WEAKENING", "RISING"], // allow RISING for resurfacing early signals
  };

  if (!allowed[surface.decisionState].includes(surface.confidenceTrajectory)) {
    return {
      ...surface,
      decisionState: "REFRESH",
      confidenceTrajectory: "WEAKENING",
      decisionRationale: "Decision/trajectory mismatch; defaulting to safe refresh state.",
      decisionNextStep: "Refresh later; do not act on unstable signal.",
    };
  }

  return surface;
}

/**
 * Public function used by routes.
 */
export function surfaceDecision(i: Inputs): DecisionSurface {
  const signalStrength = deriveSignalStrength(i);
  const confidenceTrajectory = deriveTrajectory(i);
  const decisionState = deriveDecisionState(signalStrength, confidenceTrajectory, i.qualityScore);

  // Human-readable rationale: short, calm, non-hype.
  let decisionRationale = "";
  let decisionNextStep = "";

  if (decisionState === "ACT") {
    decisionRationale = "Sufficient signal convergence to justify action now.";
    decisionNextStep = "Proceed to angles and scripts; move with restraint, not certainty.";
  } else if (decisionState === "WAIT") {
    decisionRationale = "Signal is forming; direction is emerging but timing is unresolved.";
    decisionNextStep = "Prepare variants; monitor reconfirmation before committing.";
  } else {
    decisionRationale = "Insufficient convergence to reason from right now.";
    decisionNextStep = "Refresh later; do not force a moment.";
  }

  return enforce({
    decisionState,
    confidenceTrajectory,
    signalStrength,
    decisionRationale,
    decisionNextStep,
  });
}
