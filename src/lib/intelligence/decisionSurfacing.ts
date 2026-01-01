// src/lib/intelligence/decisionSurfacing.ts
//
// Stage D.6 — Decision Surfacing (enforced)
// Stage 3.2 — Confidence Trajectory (deterministic)
//
// Purpose (Stage 3.2):
// - Surface a *movement* label for each moment: ACCELERATING / STABLE / WEAKENING / VOLATILE
// - Do this using ONLY deterministic evidence (timestamps + counts).
// - No semantic interpretation. No “AI guessing.”
//
// Hard rules:
// - Never throw
// - Never allow ACT with WEAK
// - Never allow ACT with WEAKENING
// - Enforce compatibility table conservatively (downgrade only)
//
// Notes:
// - We do NOT have full time-series per moment (yet), so “trajectory” is inferred from:
//   - age (firstSeenAt -> now)
//   - recency (lastConfirmedAt -> now)
//   - density proxy (signalCount, sourceCount)
// - This is explainable and stable, but intentionally conservative.

import type {
  DecisionSurface,
  DecisionState,
  ConfidenceTrajectory,
  SignalStrength,
} from "./decisionTypes";

type Inputs = {
  signalCount: number;
  sourceCount: number;

  // ISO timestamps if available (from your memory / qualification)
  firstSeenAt?: string;
  lastConfirmedAt?: string;

  // Optional quality score if you already have it in your pipeline (keep deterministic usage)
  qualityScore?: number;

  // Optional: free-form evidence notes from upstream (NOT used for trajectory in Stage 3.2)
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
 *
 * Heuristics (conservative):
 * - ACCELERATING: confirmed very recently AND (newish OR high density)
 * - WEAKENING: not confirmed in a long time relative to age
 * - VOLATILE: older moment with intermittent confirmations + density spike proxy
 * - STABLE: default
 */
function deriveConfidenceTrajectory(nowMs: number, inputs: Inputs): ConfidenceTrajectory {
  const signalCount = clampInt(inputs.signalCount ?? 0, 0, 10_000);
  const sourceCount = clampInt(inputs.sourceCount ?? 0, 0, 1_000);

  const firstSeenMs = safeDateMs(inputs.firstSeenAt);
  const lastConfirmedMs = safeDateMs(inputs.lastConfirmedAt);

  // If we lack timestamps, be honest + conservative.
  if (!firstSeenMs && !lastConfirmedMs) return "STABLE";

  const ageHours =
    firstSeenMs != null ? hoursBetween(nowMs, firstSeenMs) : null;

  const recencyMins =
    lastConfirmedMs != null ? minutesBetween(nowMs, lastConfirmedMs) : null;

  // ---- ACCELERATING ----
  // Very recent confirmation + meaningful density.
  // (We require some density so we don’t “accelerate” on a single ping.)
  const veryRecent = recencyMins != null && recencyMins <= 90; // 1.5h
  const recent = recencyMins != null && recencyMins <= 240; // 4h

  const dense =
    signalCount >= 10 ||
    (signalCount >= 7 && sourceCount >= 2) ||
    (signalCount >= 5 && sourceCount >= 3);

  const newish = ageHours != null && ageHours <= 24;

  if ((veryRecent && dense) || (recent && dense && newish)) {
    return "ACCELERATING";
  }

  // ---- WEAKENING ----
  // Not confirmed for a long time, especially if the moment is not brand new.
  const staleConfirm = recencyMins != null && recencyMins >= 24 * 60; // 24h+
  const notNew = ageHours != null && ageHours >= 36; // 1.5 days+

  if (staleConfirm && notNew) {
    return "WEAKENING";
  }

  // ---- VOLATILE ----
  // We don’t have time-series, so “volatile” means:
  // - moment has been around a while
  // - confirmations are not very recent but not fully stale
  // - density is high enough to suggest spiky attention
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
 * This is used to guard decisions.
 */
function deriveSignalStrength(nowMs: number, inputs: Inputs): SignalStrength {
  const signalCount = clampInt(inputs.signalCount ?? 0, 0, 10_000);
  const sourceCount = clampInt(inputs.sourceCount ?? 0, 0, 1_000);

  const lastConfirmedMs = safeDateMs(inputs.lastConfirmedAt);
  const recencyMins = lastConfirmedMs != null ? minutesBetween(nowMs, lastConfirmedMs) : null;

  const veryRecent = recencyMins != null && recencyMins <= 180; // 3h
  const recent = recencyMins != null && recencyMins <= 24 * 60; // 24h

  // Conservative scoring:
  // - STRONG requires breadth or high density + recency
  // - MODERATE is mid density/breadth + at least recent
  // - WEAK otherwise
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
 * We never “upgrade” beyond what evidence allows.
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

  // Compatibility table (conservative):
  // WEAK -> WAIT
  if (strength === "WEAK") return "WAIT";

  // MODERATE:
  // - ACCELERATING can be REFRESH (not ACT)
  // - others remain WAIT/REFRESH
  if (strength === "MODERATE") {
    if (decision === "ACT") return "REFRESH";
    if (trajectory !== "ACCELERATING" && decision === "REFRESH") return "WAIT";
    return decision;
  }

  // STRONG:
  // - ACT allowed only if ACCELERATING
  // - VOLATILE should be REFRESH
  if (strength === "STRONG") {
    if (trajectory === "VOLATILE" && decision === "ACT") return "REFRESH";
    if (trajectory !== "ACCELERATING" && decision === "ACT") return "REFRESH";
    return decision;
  }

  return decision;
}

/**
 * Main surfacing function (never throws).
 * Keeps contract stable.
 */
export function surfaceDecision(inputs: Inputs): DecisionSurface {
  try {
    const nowMs = Date.now();

    const confidenceTrajectory = deriveConfidenceTrajectory(nowMs, inputs);
    const signalStrength = deriveSignalStrength(nowMs, inputs);

    // Base decision (conservative default).
    // If your pipeline already sets a preliminary decision upstream,
    // pass it in via inputs later — but for now we stay safe.
    let decisionState: DecisionState = "REFRESH";
    let decisionRationale = "Re-check recommended to confirm convergence and momentum.";

    // Conservative defaults based on evidence (still deterministic)
    if (signalStrength === "WEAK") {
      decisionState = "WAIT";
      decisionRationale = "Insufficient signal density/breadth to act confidently right now.";
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

    // If compatibility downgraded, keep rationale honest.
    if (decisionState === "WAIT" && signalStrength !== "WEAK" && confidenceTrajectory !== "WEAKENING") {
      // This can happen from compatibility rules (e.g. MODERATE + STABLE).
      decisionRationale = "Not enough evidence for action timing yet; wait for stronger acceleration or breadth.";
    }
    if (decisionState === "REFRESH" && signalStrength === "MODERATE" && confidenceTrajectory !== "ACCELERATING") {
      decisionRationale = "Moderate signal without acceleration; refresh later to confirm direction.";
    }

    return {
      decisionState,
      confidenceTrajectory,
      signalStrength,
      decisionRationale,
    };
  } catch {
    // Never-500 / never-throw fallback
    return {
      decisionState: "WAIT",
      confidenceTrajectory: "STABLE",
      signalStrength: "WEAK",
      decisionRationale: "Unable to confidently evaluate evidence; defaulting to safe WAIT.",
    };
  }
}
