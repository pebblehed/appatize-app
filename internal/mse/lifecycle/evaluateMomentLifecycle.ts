// /internal/mse/lifecycle/evaluateMomentLifecycle.ts
//
// Stage D.5 — Moment Lifecycle, Decay & Drift Control
//
// Single-source HN mode has low identity bandwidth (titles only).
// Therefore drift detection must be title-dominant + lower ICS threshold,
// otherwise everything "drifts" artificially.

import type { MomentMemoryRecord } from "@internal/contracts/MOMENT_MEMORY_RECORD";

export type SignalItem = {
  source: "hackernews" | "reddit" | "fusion";
  text: string; // in single-source mode this will usually be title only
  keywords?: string[];
  entities?: string[];
};

export type MomentSignalContext = {
  windowLabel: string;
  signals: SignalItem[];
};

export type MomentHealthState = "VALID" | "WEAK" | "INVALID";

export type MomentHealth = {
  state: MomentHealthState;
  SIS: number;
  ICS: number;
  evaluatedAt: string;
  windowLabel: string;
  invalidReason?: "NO_EVIDENCE" | "IDENTITY_DRIFT" | "CANONICAL_MISSING";
  explain: {
    signal: string[];
    identity: string[];
  };
};

export type MomentLifecycleThresholds = {
  minSISExistence: number;
  minSISValid: number;
  minICSSingleSource: number;
  minICSMultiSource: number;
};

export const DEFAULT_MOMENT_LIFECYCLE_THRESHOLDS: MomentLifecycleThresholds = {
  minSISExistence: 0.18,
  minSISValid: 0.55,
  // Title-only evidence is noisy; 0.25 is a realistic floor.
  minICSSingleSource: 0.25,
  // Richer multi-source identity can demand more.
  minICSMultiSource: 0.45,
};

function clamp01(x: number) {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
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

function computeSIS(signals: SignalItem[]): number {
  const n = signals.length;
  const volumeScore = clamp01(n / 3); // 3+ strong enough
  const sourceSet = new Set(signals.map((s) => s.source).filter(Boolean));
  const diversityScore = clamp01(sourceSet.size / 2); // 1 source => 0.5
  return clamp01(0.75 * volumeScore + 0.25 * diversityScore);
}

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

  return { ICS, keywordContinuity, entityContinuity };
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

  if (canonKw.length === 0 && canonEn.length === 0) {
    return {
      state: "INVALID",
      SIS: 0,
      ICS: 0,
      evaluatedAt,
      windowLabel: ctx.windowLabel,
      invalidReason: "CANONICAL_MISSING",
      explain: {
        signal: [
          `Evidence window: ${ctx.windowLabel}.`,
          `Signals matched to this moment: ${ctx.signals.length}.`,
        ],
        identity: [
          "Canonical identity missing (signatureKeywords/anchorEntities empty).",
          "Refusing lifecycle evaluation to protect credibility.",
        ],
      },
    };
  }

  const SIS = computeSIS(ctx.signals);

  if (ctx.signals.length === 0 || SIS < th.minSISExistence) {
    return {
      state: "INVALID",
      SIS,
      ICS: 0,
      evaluatedAt,
      windowLabel: ctx.windowLabel,
      invalidReason: "NO_EVIDENCE",
      explain: {
        signal: [
          `Evidence window: ${ctx.windowLabel}.`,
          `Signals matched to this moment: ${ctx.signals.length}.`,
          `SIS below existence minimum (${th.minSISExistence}).`,
        ],
        identity: ["Identity continuity cannot be evaluated without evidence."],
      },
    };
  }

  const { ICS, keywordContinuity, entityContinuity } = computeICS(memory, ctx.signals);

  const activeSources = new Set(ctx.signals.map((s) => s.source));
  const isSingleSource = activeSources.size <= 1;

  const minICS = isSingleSource ? th.minICSSingleSource : th.minICSMultiSource;

  if (ICS < minICS) {
    return {
      state: "INVALID",
      SIS,
      ICS,
      evaluatedAt,
      windowLabel: ctx.windowLabel,
      invalidReason: "IDENTITY_DRIFT",
      explain: {
        signal: [
          `Evidence window: ${ctx.windowLabel}.`,
          `Signals matched to this moment: ${ctx.signals.length}.`,
          `Active sources: ${activeSources.size} (${Array.from(activeSources).join(", ")}).`,
        ],
        identity: [
          `Keyword continuity: ${Math.round(keywordContinuity * 100)}%.`,
          `Entity continuity: ${Math.round(entityContinuity * 100)}%.`,
          `Identity continuity below minimum (${minICS}) for ${isSingleSource ? "single-source" : "multi-source"} mode.`,
        ],
      },
    };
  }

  const state: MomentHealthState = SIS < th.minSISValid ? "WEAK" : "VALID";

  return {
    state,
    SIS,
    ICS,
    evaluatedAt,
    windowLabel: ctx.windowLabel,
    explain: {
      signal: [
        `Evidence window: ${ctx.windowLabel}.`,
        `Signals matched to this moment: ${ctx.signals.length}.`,
        `Active sources: ${activeSources.size} (${Array.from(activeSources).join(", ")}).`,
      ],
      identity: [
        `Keyword continuity: ${Math.round(keywordContinuity * 100)}%.`,
        `Entity continuity: ${Math.round(entityContinuity * 100)}%.`,
        "Identity continuity within acceptable range for this evidence mode.",
      ],
    },
  };
}
