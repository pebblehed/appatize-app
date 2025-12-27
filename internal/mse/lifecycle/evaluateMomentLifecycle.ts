// /internal/mse/lifecycle/evaluateMomentLifecycle.ts
//
// Stage D.5 — Moment Lifecycle, Decay & Drift Control
//
// KEY PRINCIPLE:
// - Multi-source moments can be strict (identity drift = INVALID).
// - Single-source HN moments have low identity bandwidth (often one title).
//   If we treat low continuity as hard drift, EVERYTHING expires and the UX deadlocks.
//   Therefore in single-source mode:
//     - "Low continuity" becomes WEAK (valid) with explicit warnings.
//     - Only "no evidence at all" remains INVALID.
//
// This preserves credibility:
// - We do NOT claim strong convergence.
// - We allow script generation under "thin evidence" (WAIT semantics),
//   rather than forcing REFRESH forever in single-source hardening.
//
// NOTE:
// This function returns a stable shape usable by the scripts route:
// - state (VALID | WEAK | INVALID)
// - invalidReason (when INVALID)
// - sis/ics (0..100) + SIS/ICS aliases for compatibility
// - isValid + lifecycleState + explain[] blocks (UI-friendly)

import type { MomentMemoryRecord } from "@internal/contracts/MOMENT_MEMORY_RECORD";

export type SignalItem = {
  source: "hackernews" | "reddit" | "fusion";
  text: string; // in single-source mode this will usually be title-only
  keywords?: string[];
  entities?: string[];
};

export type MomentSignalContext = {
  windowLabel: string;
  signals: SignalItem[];
};

export type MomentHealthState = "VALID" | "WEAK" | "INVALID";

export type MomentLifecycleThresholds = {
  // SIS is on a 0..1 scale internally
  minSISExistence: number;
  minSISValid: number;

  // ICS is on a 0..1 scale internally
  minICSSingleSource: number;
  minICSMultiSource: number;

  // Single-source allowance:
  // If true, low-ICS does NOT hard-fail in single-source mode; it becomes WEAK with warnings.
  allowWeakSingleSourceOnLowICS: boolean;
};

export const DEFAULT_MOMENT_LIFECYCLE_THRESHOLDS: MomentLifecycleThresholds = {
  // In single-source HN, 1 item is still "some evidence" (SIS will be modest).
  minSISExistence: 0.18,
  minSISValid: 0.55,

  // Title-only evidence is noisy; 0.25 is a realistic floor.
  minICSSingleSource: 0.25,

  // Richer multi-source identity can demand more.
  minICSMultiSource: 0.45,

  // 🔥 This is the critical switch that prevents permanent REFRESH deadlocks in HN-only mode.
  allowWeakSingleSourceOnLowICS: true,
};

type ExplainBlock = {
  kind: "pass" | "warn" | "fail";
  title: string;
  message: string;
  details?: Record<string, unknown>;
};

export type MomentHealth = {
  // Primary state used by downstream gating
  state: MomentHealthState;

  // "EXPIRED" is represented as INVALID, but we surface a friendlier lifecycleState for UI
  lifecycleState: "VALID" | "WEAK" | "EXPIRED";

  // Convenience: downstream can rely on this instead of inferring from `state`
  isValid: boolean;

  // Scores returned in both forms:
  // - sis/ics: 0..100 (UI-friendly)
  // - SIS/ICS: 0..100 (back-compat alias)
  sis: number;
  ics: number;
  SIS: number;
  ICS: number;

  evaluatedAt: string;
  lastEvaluatedAt: string;
  windowLabel: string;

  matchedSignals: number;
  activeSources: string[];

  invalidReason?: "NO_EVIDENCE" | "IDENTITY_DRIFT" | "CANONICAL_MISSING";

  // UI-friendly explain blocks
  explain: ExplainBlock[];

  // Legacy-style details if needed (kept small + optional)
  explainDetail?: {
    signal: string[];
    identity: string[];
  };
};

function clamp01(x: number) {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function clamp0to100(x: number) {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function toPct01(x: number) {
  // returns 0..100 with one decimal
  return Math.round(clamp01(x) * 1000) / 10;
}

function safeArray(x: any): string[] {
  return Array.isArray(x)
    ? x
        .filter((v) => typeof v === "string" && v.trim())
        .map((v) => String(v).trim().toLowerCase())
    : [];
}

function jaccard(a: string[], b: string[]) {
  const A = new Set((a || []).map((x) => x.toLowerCase()).filter(Boolean));
  const B = new Set((b || []).map((x) => x.toLowerCase()).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;

  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * SIS: signal intensity score (0..1)
 * - volume dominates in this phase
 * - source diversity contributes (but single-source isn't punished to 0)
 */
function computeSIS(signals: SignalItem[]): number {
  const n = signals.length;
  const volumeScore = clamp01(n / 3); // 3+ signals -> 1.0
  const sourceSet = new Set(signals.map((s) => s.source).filter(Boolean));
  const diversityScore = clamp01(sourceSet.size / 2); // 1 source -> 0.5, 2+ -> 1.0
  return clamp01(0.75 * volumeScore + 0.25 * diversityScore);
}

/**
 * ICS: identity continuity score (0..1)
 * Compares canonical identity to evidence identity.
 */
function computeICS(memory: MomentMemoryRecord, signals: SignalItem[]) {
  const canonicalKeywords = safeArray((memory as any)?.canonical?.signatureKeywords);
  const canonicalEntities = safeArray((memory as any)?.canonical?.anchorEntities);

  const evidenceKeywords: string[] = [];
  const evidenceEntities: string[] = [];

  for (const s of signals) {
    evidenceKeywords.push(...safeArray(s.keywords));
    evidenceEntities.push(...safeArray(s.entities));
  }

  const kw = Array.from(new Set(evidenceKeywords));
  const en = Array.from(new Set(evidenceEntities));

  const keywordContinuity = jaccard(canonicalKeywords, kw);
  const entityContinuity = jaccard(canonicalEntities, en);

  // In title-only mode, keywords behave like anchors too.
  const ICS = clamp01(0.6 * keywordContinuity + 0.4 * entityContinuity);

  return {
    ICS,
    keywordContinuity,
    entityContinuity,
    canonicalKeywordsCount: canonicalKeywords.length,
    canonicalEntitiesCount: canonicalEntities.length,
    evidenceKeywordsCount: kw.length,
    evidenceEntitiesCount: en.length,
  };
}

export function evaluateMomentLifecycle(args: {
  memory: MomentMemoryRecord;
  signalContext: MomentSignalContext;
  thresholds?: MomentLifecycleThresholds;
}): MomentHealth {
  const memory = args.memory;
  const ctx = args.signalContext;
  const th = args.thresholds ?? DEFAULT_MOMENT_LIFECYCLE_THRESHOLDS;
  const evaluatedAt = new Date().toISOString();

  const canonKw = safeArray((memory as any)?.canonical?.signatureKeywords);
  const canonEn = safeArray((memory as any)?.canonical?.anchorEntities);

  const matchedSignals = Array.isArray(ctx?.signals) ? ctx.signals.length : 0;
  const activeSourcesSet = new Set((ctx.signals ?? []).map((s) => s.source).filter(Boolean));
  const activeSources = Array.from(activeSourcesSet);
  const isSingleSource = activeSourcesSet.size <= 1;

  const explain: ExplainBlock[] = [];

  // --- Canonical must exist ---
  if (canonKw.length === 0 && canonEn.length === 0) {
    explain.push({
      kind: "fail",
      title: "Canonical identity missing",
      message: "signatureKeywords/anchorEntities are empty. Refusing lifecycle evaluation to protect credibility.",
      details: { canonicalKeywords: canonKw.length, canonicalEntities: canonEn.length },
    });

    return {
      state: "INVALID",
      lifecycleState: "EXPIRED",
      isValid: false,

      sis: 0,
      ics: 0,
      SIS: 0,
      ICS: 0,

      evaluatedAt,
      lastEvaluatedAt: evaluatedAt,
      windowLabel: ctx.windowLabel,

      matchedSignals,
      activeSources,

      invalidReason: "CANONICAL_MISSING",
      explain,
      explainDetail: {
        signal: [
          `Evidence window: ${ctx.windowLabel}.`,
          `Signals matched: ${matchedSignals}.`,
        ],
        identity: ["Canonical identity missing (signatureKeywords/anchorEntities empty)."],
      },
    };
  }

  // --- SIS existence gate ---
  const sis01 = computeSIS(ctx.signals ?? []);
  const SIS = toPct01(sis01); // 0..100

  explain.push({
    kind: sis01 >= th.minSISExistence ? "pass" : "fail",
    title: "Signal existence",
    message:
      sis01 >= th.minSISExistence
        ? "Evidence exists in the current window."
        : "Evidence is below minimum existence threshold.",
    details: {
      windowLabel: ctx.windowLabel,
      matchedSignals,
      activeSources,
      sis01,
      minSISExistence: th.minSISExistence,
    },
  });

  if (matchedSignals === 0 || sis01 < th.minSISExistence) {
    // Hard stop: truly no evidence.
    return {
      state: "INVALID",
      lifecycleState: "EXPIRED",
      isValid: false,

      sis: SIS,
      ics: 0,
      SIS: SIS,
      ICS: 0,

      evaluatedAt,
      lastEvaluatedAt: evaluatedAt,
      windowLabel: ctx.windowLabel,

      matchedSignals,
      activeSources,

      invalidReason: "NO_EVIDENCE",
      explain: [
        ...explain,
        {
          kind: "fail",
          title: "No evidence",
          message: "Identity continuity cannot be evaluated without evidence.",
          details: { matchedSignals, SIS, minSISExistence: th.minSISExistence },
        },
      ],
      explainDetail: {
        signal: [
          `Evidence window: ${ctx.windowLabel}.`,
          `Signals matched: ${matchedSignals}.`,
          `SIS below existence minimum (${th.minSISExistence}).`,
        ],
        identity: ["Identity continuity cannot be evaluated without evidence."],
      },
    };
  }

  // --- ICS continuity gate ---
  const icsResult = computeICS(memory, ctx.signals ?? []);
  const ics01 = icsResult.ICS;
  const ICS = toPct01(ics01); // 0..100

  const minICS = isSingleSource ? th.minICSSingleSource : th.minICSMultiSource;

  explain.push({
    kind: ics01 >= minICS ? "pass" : "warn",
    title: "Identity continuity",
    message:
      ics01 >= minICS
        ? "Live evidence aligns with canonical identity."
        : isSingleSource && th.allowWeakSingleSourceOnLowICS
          ? "Continuity is low in single-source mode. Marking as WEAK (valid) with warnings — not hard drift."
          : "Continuity is below minimum — identity drift suspected.",
    details: {
      isSingleSource,
      minICS,
      ics01,
      keywordContinuity: icsResult.keywordContinuity,
      entityContinuity: icsResult.entityContinuity,
      canonicalKeywordsCount: icsResult.canonicalKeywordsCount,
      canonicalEntitiesCount: icsResult.canonicalEntitiesCount,
      evidenceKeywordsCount: icsResult.evidenceKeywordsCount,
      evidenceEntitiesCount: icsResult.evidenceEntitiesCount,
    },
  });

  // Multi-source (or strict mode) drift remains a hard fail.
  if (ics01 < minICS && !(isSingleSource && th.allowWeakSingleSourceOnLowICS)) {
    return {
      state: "INVALID",
      lifecycleState: "EXPIRED",
      isValid: false,

      sis: SIS,
      ics: ICS,
      SIS: SIS,
      ICS: ICS,

      evaluatedAt,
      lastEvaluatedAt: evaluatedAt,
      windowLabel: ctx.windowLabel,

      matchedSignals,
      activeSources,

      invalidReason: "IDENTITY_DRIFT",
      explain: [
        ...explain,
        {
          kind: "fail",
          title: "Identity drift",
          message: "Continuity below minimum for this evidence mode. Refusing script generation to protect credibility.",
          details: { isSingleSource, minICS, ICS, matchedSignals },
        },
      ],
      explainDetail: {
        signal: [
          `Evidence window: ${ctx.windowLabel}.`,
          `Signals matched: ${matchedSignals}.`,
          `Active sources: ${activeSourcesSet.size} (${activeSources.join(", ")}).`,
        ],
        identity: [
          `Keyword continuity: ${Math.round(icsResult.keywordContinuity * 100)}%.`,
          `Entity continuity: ${Math.round(icsResult.entityContinuity * 100)}%.`,
          `Identity continuity below minimum (${minICS}) for ${
            isSingleSource ? "single-source" : "multi-source"
          } mode.`,
        ],
      },
    };
  }

  // --- Determine overall state ---
  // If SIS is below "valid", we mark WEAK.
  // Additionally, if single-source continuity was low, we also mark WEAK (still valid).
  const sisWeak = sis01 < th.minSISValid;
  const icsWeakSingleSource = isSingleSource && ics01 < minICS;

  const state: MomentHealthState = sisWeak || icsWeakSingleSource ? "WEAK" : "VALID";
  const lifecycleState: "VALID" | "WEAK" = state === "VALID" ? "VALID" : "WEAK";

  if (state === "WEAK") {
    explain.push({
      kind: "warn",
      title: "Thin evidence",
      message:
        "Moment is usable, but evidence is thin. Treat outputs as exploratory; prefer waiting for reinforcement before acting.",
      details: {
        SIS,
        minSISValid: th.minSISValid,
        ICS,
        minICS,
        isSingleSource,
      },
    });
  } else {
    explain.push({
      kind: "pass",
      title: "Governable",
      message: "Moment passed lifecycle gating for script generation.",
      details: { SIS, ICS, matchedSignals, activeSources },
    });
  }

  return {
    state,
    lifecycleState,
    isValid: true,

    sis: clamp0to100(SIS),
    ics: clamp0to100(ICS),
    SIS: clamp0to100(SIS),
    ICS: clamp0to100(ICS),

    evaluatedAt,
    lastEvaluatedAt: evaluatedAt,
    windowLabel: ctx.windowLabel,

    matchedSignals,
    activeSources,

    explain,
    explainDetail: {
      signal: [
        `Evidence window: ${ctx.windowLabel}.`,
        `Signals matched: ${matchedSignals}.`,
        `Active sources: ${activeSourcesSet.size} (${activeSources.join(", ")}).`,
      ],
      identity: [
        `Keyword continuity: ${Math.round(icsResult.keywordContinuity * 100)}%.`,
        `Entity continuity: ${Math.round(icsResult.entityContinuity * 100)}%.`,
        state === "VALID"
          ? "Identity continuity within acceptable range."
          : "Identity continuity acceptable for single-source WEAK mode, but not strong enough to claim convergence.",
      ],
    },
  };
}
