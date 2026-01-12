// src/lib/intelligence/decisionSurfacing.ts
//
// Stage D.6 — Decision Surfacing (enforced)
// Stage 3.2 — Confidence Trajectory (deterministic)
//
// Purpose (Stage 3.2):
// - Surface a *movement* label for each moment: ACCELERATING / STABLE / WEAKENING / VOLATILE
// - Do this using ONLY deterministic evidence (timestamps + counts).
// - No semantic interpretation. No “AI guessing.”

import type {
  DecisionSurface,
  DecisionState,
  ConfidenceTrajectory,
  SignalStrength,
} from "./decisionTypes";

type Inputs = {
  signalCount: number;
  sourceCount: number;
  firstSeenAt?: string;
  lastConfirmedAt?: string;

  /**
   * Deterministic quality proxy (0–100).
   * - Backward compatible key: qualityScore
   * - Current engine key: momentQualityScore
   *
   * We accept both to avoid brittle wiring and any-casts.
   */
  qualityScore?: number;
  momentQualityScore?: number;

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

function getQualityScore(inputs: Inputs): number {
  const q = inputs.qualityScore ?? inputs.momentQualityScore ?? 0;
  return Number.isFinite(q) ? Math.max(0, Math.min(100, q)) : 0;
}

function deriveConfidenceTrajectory(nowMs: number, inputs: Inputs): ConfidenceTrajectory {
  const signalCount = clampInt(inputs.signalCount ?? 0, 0, 10_000);
  const sourceCount = clampInt(inputs.sourceCount ?? 0, 0, 1_000);

  const firstSeenMs = safeDateMs(inputs.firstSeenAt);
  const lastConfirmedMs = safeDateMs(inputs.lastConfirmedAt);

  if (!firstSeenMs && !lastConfirmedMs) return "STABLE";

  const ageHours = firstSeenMs != null ? hoursBetween(nowMs, firstSeenMs) : null;
  const recencyMins = lastConfirmedMs != null ? minutesBetween(nowMs, lastConfirmedMs) : null;

  const veryRecent = recencyMins != null && recencyMins <= 90;
  const recent = recencyMins != null && recencyMins <= 240;

  const dense =
    signalCount >= 10 ||
    (signalCount >= 7 && sourceCount >= 2) ||
    (signalCount >= 5 && sourceCount >= 3);

  const newish = ageHours != null && ageHours <= 24;

  if ((veryRecent && dense) || (recent && dense && newish)) {
    return "ACCELERATING";
  }

  const staleConfirm = recencyMins != null && recencyMins >= 24 * 60;
  const notNew = ageHours != null && ageHours >= 36;

  if (staleConfirm && notNew) {
    return "WEAKENING";
  }

  const older = ageHours != null && ageHours >= 48;
  const midRecency = recencyMins != null && recencyMins > 240 && recencyMins < 24 * 60;

  if (older && midRecency && (signalCount >= 12 || (signalCount >= 9 && sourceCount >= 2))) {
    return "VOLATILE";
  }

  return "STABLE";
}

function deriveSignalStrength(nowMs: number, inputs: Inputs): SignalStrength {
  const signalCount = clampInt(inputs.signalCount ?? 0, 0, 10_000);
  const sourceCount = clampInt(inputs.sourceCount ?? 0, 0, 1_000);

  const lastConfirmedMs = safeDateMs(inputs.lastConfirmedAt);
  const recencyMins = lastConfirmedMs != null ? minutesBetween(nowMs, lastConfirmedMs) : null;

  const veryRecent = recencyMins != null && recencyMins <= 180;
  const recent = recencyMins != null && recencyMins <= 24 * 60;

  const strong =
    (veryRecent && sourceCount >= 3 && signalCount >= 7) ||
    (veryRecent && signalCount >= 14) ||
    (recent && sourceCount >= 4 && signalCount >= 10);

  if (strong) return "STRONG";

  const moderate =
    (recent && sourceCount >= 2 && signalCount >= 6) ||
    (veryRecent && signalCount >= 8) ||
    (recent && sourceCount >= 3 && signalCount >= 5);

  if (moderate) return "MODERATE";

  return "WEAK";
}

function enforceDecisionCompatibility(
  decision: DecisionState,
  strength: SignalStrength,
  trajectory: ConfidenceTrajectory
): DecisionState {
  if (strength === "WEAK") return "REFRESH";
  if (trajectory === "WEAKENING" && decision === "ACT") return "WAIT";

  if (strength === "MODERATE") {
    if (decision === "ACT") return "REFRESH";
    if (trajectory !== "ACCELERATING" && decision === "REFRESH") return "WAIT";
    return decision;
  }

  if (strength === "STRONG") {
    if (trajectory !== "ACCELERATING" && decision === "ACT") return "REFRESH";
    if (trajectory === "VOLATILE" && decision === "ACT") return "REFRESH";
    return decision;
  }

  return decision;
}

export function surfaceDecision(inputs: Inputs): DecisionSurface {
  try {
    const nowMs = Date.now();

    const signalCount = clampInt(inputs.signalCount ?? 0, 0, 10_000);
    const sourceCount = clampInt(inputs.sourceCount ?? 0, 0, 1_000);

    const lastConfirmedMs = safeDateMs(inputs.lastConfirmedAt);

    const qualityScore = getQualityScore(inputs);

    const belowExistence =
      (signalCount < 3 && sourceCount < 2) || (signalCount < 2 && sourceCount < 3);

    const stale = lastConfirmedMs != null && hoursBetween(nowMs, lastConfirmedMs) >= 48;

    if (belowExistence) {
      return {
        decisionState: "REFRESH",
        confidenceTrajectory: "STABLE",
        signalStrength: "WEAK",
        decisionRationale:
          "Insufficient evidence to evaluate reliably; refresh when more signals or sources appear.",
      };
    }

    if (stale) {
      return {
        decisionState: "REFRESH",
        confidenceTrajectory: "STABLE",
        signalStrength: "WEAK",
        decisionRationale:
          "Evidence is stale; refresh to confirm whether the moment is still active.",
      };
    }

    const confidenceTrajectory = deriveConfidenceTrajectory(nowMs, inputs);
    let signalStrength = deriveSignalStrength(nowMs, inputs);

    // Deterministic quality tie-breaker (does NOT invent meaning):
    // If the cluster’s quality proxy is very high, allow "MODERATE" → "STRONG" upgrade,
    // but ONLY when the evidence is also recent. This helps ACT surface when it truly should,
    // without relying on raw counts alone.
    const recencyMins = lastConfirmedMs != null ? minutesBetween(nowMs, lastConfirmedMs) : null;
    const recentEnough = recencyMins != null && recencyMins <= 240;

    if (recentEnough && qualityScore >= 75 && signalStrength === "MODERATE") {
      signalStrength = "STRONG";
    }

    let decisionState: DecisionState = "REFRESH";
    let decisionRationale = "Signals are present but not decisive; refresh for confirmation.";

    if (signalStrength === "WEAK") {
      decisionState = "REFRESH";
      decisionRationale =
        "Signal is below the readiness threshold; refresh when more evidence appears.";
    } else if (confidenceTrajectory === "WEAKENING") {
      decisionState = "WAIT";
      decisionRationale = "Signals appear to be weakening; wait for renewed confirmation.";
    } else if (signalStrength === "STRONG" && confidenceTrajectory === "ACCELERATING") {
      decisionState = "ACT";
      decisionRationale = "Strong and accelerating signals suggest a timely action window.";
    } else if (signalStrength === "STRONG" && confidenceTrajectory === "VOLATILE") {
      decisionState = "REFRESH";
      decisionRationale = "Strong but volatile signals; refresh to avoid false timing.";
    }

    decisionState = enforceDecisionCompatibility(
      decisionState,
      signalStrength,
      confidenceTrajectory
    );

    return {
      decisionState,
      confidenceTrajectory,
      signalStrength,
      decisionRationale,
    };
  } catch {
    return {
      decisionState: "REFRESH",
      confidenceTrajectory: "STABLE",
      signalStrength: "WEAK",
      decisionRationale:
        "Unable to confidently evaluate evidence; refresh when more signals appear.",
    };
  }
}
