// src/lib/intelligence/qualifyMoment.ts
//
// Stage D.3 — Moment Quality Firewall (deterministic)
//
// Guarantees:
// - Deterministic: no time-now, no randomness, no I/O
// - Explainable: returns allow/reject + stable reasons
// - Non-bypassable once wired: caller must drop rejected moments
//
// Scope (minimal, production-only):
// - Uses ONLY stable primitives already present on the moment/trend:
//   - momentScore (canonical)
//   - evidence signalCount/sourceCount
//
// Note: This is a firewall, not a scorer. It does not compute a score.
// It enforces minimum quality requirements before a moment can be surfaced.

import type { MomentScore } from "./momentScore";

export type QualityDecision = "ALLOW" | "REJECT";

export type QualifyResult = {
  decision: QualityDecision;
  reasons: string[]; // stable reason codes
};

type EvidenceLike = {
  signalCount?: unknown;
  sourceCount?: unknown;
};

type MomentLike = {
  momentScore?: unknown;
  evidence?: unknown;
};

// Tunable firewall floor.
// Goal: allow early WAIT/REFRESH candidates through for visibility,
// while still blocking extreme low-quality noise.
const COMPOSITE_MIN = 10;

function toIntOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v);
}

function clamp(min: number, max: number, n: number) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function isMomentScore(x: unknown): x is MomentScore {
  if (!x || typeof x !== "object") return false;
  const ms = x as MomentScore;

  return (
    typeof ms.scoreModelVersion === "string" &&
    typeof ms.composite === "number" &&
    ms.components != null &&
    typeof ms.components === "object" &&
    typeof ms.components.density === "number" &&
    typeof ms.components.breadth === "number" &&
    typeof ms.components.velocity === "number" &&
    typeof ms.components.recurrence === "number" &&
    typeof ms.components.risk === "number" &&
    ms.decision != null &&
    typeof ms.decision === "object" &&
    typeof ms.decision.state === "string"
  );
}

/**
 * qualifyMoment()
 * - Returns ALLOW only when minimum deterministic quality conditions are met.
 * - Caller must drop REJECTed moments (non-bypassable once wired).
 */
export function qualifyMoment(input: unknown): QualifyResult {
  const reasons: string[] = [];
  const m = (input ?? {}) as MomentLike;

  // 1) Must have canonical MomentScore (we require the scorer to run first).
  const ms = isMomentScore(m.momentScore) ? (m.momentScore as MomentScore) : null;
  if (!ms) {
    return { decision: "REJECT", reasons: ["NO_MOMENT_SCORE"] };
  }

  // 2) Minimum composite quality gate.
  const composite = clamp(0, 100, ms.composite);
  if (composite < COMPOSITE_MIN) reasons.push("COMPOSITE_TOO_LOW");

  // 3) Evidence sanity: require at least 1 source + 1 signal.
  const evidence =
    m.evidence && typeof m.evidence === "object" ? (m.evidence as EvidenceLike) : null;

  const sourceCount =
    evidence && typeof evidence.sourceCount !== "undefined"
      ? toIntOrNull(evidence.sourceCount)
      : null;

  if (sourceCount == null) reasons.push("SOURCE_COUNT_MISSING");
  else if (sourceCount < 1) reasons.push("SOURCE_COUNT_INVALID");

  if (sourceCount != null && sourceCount < 1) reasons.push("NO_EVIDENCE_SOURCES");

  const signalCount =
    evidence && typeof evidence.signalCount !== "undefined"
      ? toIntOrNull(evidence.signalCount)
      : null;

  if (signalCount == null) reasons.push("SIGNAL_COUNT_MISSING");
  else if (signalCount < 1) reasons.push("SIGNAL_COUNT_INVALID");

  // 4) Risk hard ceiling (quality firewall, not a decision).
  const risk = clamp(0, 100, ms.components.risk);
  if (risk >= 85) reasons.push("RISK_TOO_HIGH");

  return {
    decision: reasons.length > 0 ? "REJECT" : "ALLOW",
    reasons,
  };
}
