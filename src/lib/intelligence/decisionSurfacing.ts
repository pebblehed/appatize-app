// src/lib/intelligence/decisionSurfacing.ts
//
// Stage D.6 — Decision Surfacing (enforced)
// Stage 3.2 — Confidence Trajectory (deterministic)
// Stage 3.4 — Evidence Surfacing (read-only)
//
// Purpose:
// - Surface decisionState / confidenceTrajectory / signalStrength conservatively.
// - Stage 3.4 adds evidence primitives + derived metrics for explainability.
// - No semantic interpretation. No “AI guessing.”
//
// Hard rules:
// - Never throw
// - Never allow ACT with WEAK
// - Never allow ACT with WEAKENING
// - Enforce compatibility table conservatively (downgrade only)

import type {
  DecisionSurface,
  DecisionState,
  ConfidenceTrajectory,
  SignalStrength,
  EvidenceSurface,
} from "./decisionTypes";

type Inputs = {
  signalCount: number;
  sourceCount: number;

  // ISO timestamps if available
  firstSeenAt?: string;
  lastConfirmedAt?: string;

  // Optional future hook (not used for trajectory/scoring in Stage 3.x)
  qualityScore?: number;
  evidenceText?: string;
};

const clampInt = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : min;

function safeDateMs(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function minutesBetween(aMs: number, bMs: number): number {
  return Math.abs(aMs - bMs) / 60000;
}

function hoursBetween(aMs: number, bMs: number): number {
  return Math.abs(aMs - bMs) / 3600000;
}

/**
 * Stage 3.2 — Confidence Trajectory (deterministic)
 */
function deriveConfidenceTrajectory(nowMs: number, inputs: Inputs): ConfidenceTrajectory {
  const signalCount = clampInt(inputs.signalCount ?? 0, 0, 10_000);
  const sourceCount = clampInt(inputs.sourceCount ?? 0, 0, 1_000);

  const firstSeenMs = safeDateMs(inputs.firstSeenAt);
  const lastConfirmedMs = safeDateMs(inputs.lastConfirmedAt);

  // If we lack timestamps, be honest + conservative.
  if (!firstSeenMs && !lastConfirmedMs) return "STABLE";

  const ageHours = firstSeenMs != null ? hoursBetween(nowMs, firstSeenMs) : null;
  const recencyMins = lastConfirmedMs != null ? minutesBetween(nowMs, lastConfirmedMs) : null;

  // ---- ACCELERATING ----
  const veryRecent = recencyMins != null && recencyMins <= 90; // 1.5h
  const recent = recencyMins != null && recencyMins <= 240; // 4h

  const dense =
    signalCount >= 10 ||
    (signalCount >= 7 && sourceCount >= 2) ||
    (signalCount >= 5 && sourceCount >= 3);

  const newish = ageHours != null && ageHours <= 24;

  // IMPORTANT (Stage 3.4 caution):
  // Prevent “ACCELERATING” on ultra-thin evidence (e.g., 1-2 items that are just very new).
  if ((veryRecent && dense && signalCount >= 3) || (recent && dense && newish && signalCount >= 3)) {
    return "ACCELERATING";
  }

  // ---- WEAKENING ----
  const staleConfirm = recencyMins != null && recencyMins >= 24 * 60; // 24h+
  const notNew = ageHours != null && ageHours >= 36; // 1.5 days+

  if (staleConfirm && notNew) {
    return "WEAKENING";
  }

  // ---- VOLATILE ----
  const older = ageHours != null && ageHours >= 48; // 2 days+
  const midRecency =
    recencyMins != null && recencyMins > 240 && recencyMins < 24 * 60; // 4h..24h

  if (older && midRecency && (signalCount >= 12 || (signalCount >= 9 && sourceCount >= 2))) {
    return "VOLATILE";
  }

  return "STABLE";
}

/**
 * Signal strength (kept deterministic).
 */
function deriveSignalStrength(nowMs: number, inputs: Inputs): SignalStrength {
  const signalCount = clampInt(inputs.signalCount ?? 0, 0, 10_000);
  const sourceCount = clampInt(inputs.sourceCount ?? 0, 0, 1_000);

  const lastConfirmedMs = safeDateMs(inputs.lastConfirmedAt);
  const recencyMins = lastConfirmedMs != null ? minutesBetween(nowMs, lastConfirmedMs) : null;

  const veryRecent = recencyMins != null && recencyMins <= 180; // 3h
  const recent = recencyMins != null && recencyMins <= 24 * 60; // 24h

  const strong =
    (veryRecent && (sourceCount >= 3 && signalCount >= 7)) ||
    (veryRecent && signalCount >= 14) ||
    (recent && sourceCount >= 4 && signalCount >= 10);

  if (strong) return "STRONG";

  const moderate =
    (recent && (sourceCount >= 2 && signalCount >= 6)) ||
    (veryRecent && signalCount >= 8) ||
    (recent && sourceCount >= 3 && signalCount >= 5);

  if (moderate) return "MODERATE";

  return "WEAK";
}

/**
 * Compatibility enforcement (downgrade-only).
 */
function enforceDecisionCompatibility(
  decision: DecisionState,
  strength: SignalStrength,
  trajectory: ConfidenceTrajectory
): DecisionState {
  // Hard bans
  if (strength === "WEAK") {
    if (decision === "ACT") return "WAIT";
  }
  if (trajectory === "WEAKENING") {
    if (decision === "ACT") return "WAIT";
  }

  if (strength === "WEAK") return "WAIT";

  if (strength === "MODERATE") {
    if (decision === "ACT") return "REFRESH";
    if (trajectory !== "ACCELERATING" && decision === "REFRESH") return "WAIT";
    return decision;
  }

  if (strength === "STRONG") {
    if (trajectory === "VOLATILE" && decision === "ACT") return "REFRESH";
    if (trajectory !== "ACCELERATING" && decision === "ACT") return "REFRESH";
    return decision;
  }

  return decision;
}

/**
 * Stage 3.4 — Evidence surfacing (read-only)
 * Produces stable primitives and guarded derived metrics.
 */
function deriveEvidence(nowMs: number, inputs: Inputs): EvidenceSurface {
  const signalCount = clampInt(inputs.signalCount ?? 0, 0, 10_000);
  const sourceCount = clampInt(inputs.sourceCount ?? 0, 0, 1_000);

  const firstSeenMs = safeDateMs(inputs.firstSeenAt);
  const lastConfirmedMs = safeDateMs(inputs.lastConfirmedAt);

  const ageHours =
    firstSeenMs != null ? hoursBetween(nowMs, firstSeenMs) : undefined;

  const recencyMins =
    lastConfirmedMs != null ? minutesBetween(nowMs, lastConfirmedMs) : undefined;

  // Guarded velocity: if ageHours is extremely small or missing, omit.
  const velocityPerHour =
    ageHours != null && ageHours >= 0.25 // at least 15 minutes old to avoid crazy spikes
      ? Number((signalCount / ageHours).toFixed(2))
      : undefined;

  return {
    signalCount,
    sourceCount,
    firstSeenAt: inputs.firstSeenAt,
    lastConfirmedAt: inputs.lastConfirmedAt,
    ageHours: ageHours != null ? Number(ageHours.toFixed(2)) : undefined,
    recencyMins: recencyMins != null ? Math.round(recencyMins) : undefined,
    velocityPerHour,
  };
}

/**
 * Main surfacing function (never throws).
 */
export function surfaceDecision(inputs: Inputs): DecisionSurface {
  try {
    const nowMs = Date.now();

    const confidenceTrajectory = deriveConfidenceTrajectory(nowMs, inputs);
    const signalStrength = deriveSignalStrength(nowMs, inputs);

    // Base decision (conservative default).
    let decisionState: DecisionState = "REFRESH";
    let decisionRationale = "Re-check recommended to confirm convergence and momentum.";

    if (signalStrength === "WEAK") {
      decisionState = "WAIT";
      decisionRationale = "Insufficient evidence (freshness/velocity/breadth) to act confidently right now.";
    } else if (confidenceTrajectory === "WEAKENING") {
      decisionState = "WAIT";
      decisionRationale = "Signals appear to be weakening; wait for renewed confirmation.";
    } else if (signalStrength === "STRONG" && confidenceTrajectory === "ACCELERATING") {
      decisionState = "ACT";
      decisionRationale = "Strong and accelerating signals suggest a timely action window.";
    } else if (signalStrength === "STRONG" && confidenceTrajectory === "VOLATILE") {
      decisionState = "REFRESH";
      decisionRationale = "Strong but volatile signals; refresh to avoid false timing.";
    } else {
      decisionState = "REFRESH";
      decisionRationale = "Signals are present but not decisive; refresh for confirmation.";
    }

    decisionState = enforceDecisionCompatibility(decisionState, signalStrength, confidenceTrajectory);

    if (decisionState === "WAIT" && signalStrength !== "WEAK" && confidenceTrajectory !== "WEAKENING") {
      decisionRationale =
        "Not enough evidence for action timing yet; wait for stronger acceleration or breadth.";
    }
    if (decisionState === "REFRESH" && signalStrength === "MODERATE" && confidenceTrajectory !== "ACCELERATING") {
      decisionRationale = "Moderate signal without acceleration; refresh later to confirm direction.";
    }

    return {
      decisionState,
      confidenceTrajectory,
      signalStrength,
      decisionRationale,

      // Stage 3.4: evidence surface (read-only)
      evidence: deriveEvidence(nowMs, inputs),
    };
  } catch {
    return {
      decisionState: "WAIT",
      confidenceTrajectory: "STABLE",
      signalStrength: "WEAK",
      decisionRationale: "Unable to confidently evaluate evidence; defaulting to safe WAIT.",
      evidence: {
        signalCount: 0,
        sourceCount: 0,
      },
    };
  }
}
