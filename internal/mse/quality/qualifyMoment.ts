import type {
  MomentQualification,
  MomentQualityScore,
  MomentQualityThresholds,
  MomentQualityWeights,
  MomentExplainability,
  MomentMaturity,
} from "../../contracts/MOMENT_QUALITY_CONTRACT";

import {
  DEFAULT_MOMENT_QUALITY_THRESHOLDS,
  DEFAULT_MOMENT_QUALITY_WEIGHTS,
  computeMomentOverallScore,
  evaluateMomentAgainstThresholds,
  clamp01,
} from "../../contracts/MOMENT_QUALITY_CONTRACT";

import type { SignalLike } from "./signalDensity";
import { computeSignalDensity } from "./signalDensity";

import type { TimedSignalLike } from "./velocity";
import { computeVelocity } from "./velocity";

import type { NarrativeInput } from "./narrative";
import { computeNarrativeCoherence } from "./narrative";

import type { LegibilityInput } from "./legibility";
import { computeCulturalLegibility } from "./legibility";

export type MomentCandidate = {
  id?: string;

  signals: Array<
    SignalLike &
      TimedSignalLike & {
        title?: string;
        summary?: string;
        keywords?: string[];
      }
  >;

  title?: string;
  description?: string;
  keywords?: string[];

  firstSeenAt?: string;
  collapsedFromIds?: string[];
};

export type QualifyMomentOptions = {
  weights?: MomentQualityWeights;
  thresholds?: MomentQualityThresholds;
  velocity?: {
    binMs?: number;
    bins?: number;
    recentPortion?: number;
  };
  computeMaturityOnFail?: boolean;
};

export function qualifyMoment(
  candidate: MomentCandidate,
  opts: QualifyMomentOptions = {}
): MomentQualification {
  const weights = opts.weights ?? DEFAULT_MOMENT_QUALITY_WEIGHTS;
  const thresholds = opts.thresholds ?? DEFAULT_MOMENT_QUALITY_THRESHOLDS;

  const signals = Array.isArray(candidate.signals) ? candidate.signals : [];

  const density = computeSignalDensity(
    signals.map((s) => ({ source: s.source, id: (s as any).id }))
  );

  const velocity = computeVelocity(
    signals
      .map((s) => ({ createdAt: (s as any).createdAt }))
      .filter((s) => s.createdAt !== undefined && s.createdAt !== null),
    opts.velocity
  );

  const phrases = extractPhrases(candidate, signals);
  const narrativeInput: NarrativeInput = {
    phrases,
    keywords: candidate.keywords ?? extractKeywords(signals),
  };
  const narrative = computeNarrativeCoherence(narrativeInput);

  const legibilityText =
    (candidate.title ?? "").trim() ||
    (candidate.description ?? "").trim() ||
    phrases.join(" | ").slice(0, 220);

  const legibilityInput: LegibilityInput = { text: legibilityText, phrases: phrases.slice(0, 6) };
  const legibility = computeCulturalLegibility(legibilityInput);

  const components: Omit<MomentQualityScore, "overall"> = {
    signalDensity: clamp01(density.score),
    velocity: clamp01(velocity.score),
    narrativeCoherence: clamp01(narrative.score),
    culturalLegibility: clamp01(legibility.score),
  };

  const overall = computeMomentOverallScore(components, weights);

  const score: MomentQualityScore = { ...components, overall };

  const evalResult = evaluateMomentAgainstThresholds({
    score,
    thresholds,
    uniqueSourcesCount: density.uniqueSourcesCount,
    totalSignals: density.totalSignals,
  });

  const explain: MomentExplainability = {
    uniqueSources: density.uniqueSources,
    totalSignals: density.totalSignals,
    firstSeenAt: candidate.firstSeenAt,
    collapsedFromIds: candidate.collapsedFromIds,
  };

  const maturity =
    evalResult.pass || opts.computeMaturityOnFail
      ? computeMaturityFromSignals({ velocityScore: velocity.score, totalSignals: density.totalSignals })
      : undefined;

  return {
    pass: evalResult.pass,
    score,
    reasons: evalResult.reasons,
    maturity,
    explain,
  };
}

function extractPhrases(candidate: MomentCandidate, signals: MomentCandidate["signals"]): string[] {
  const phrases: string[] = [];

  const push = (s?: string) => {
    const v = (s ?? "").trim();
    if (v) phrases.push(v);
  };

  push(candidate.title);
  push(candidate.description);

  for (const sig of signals) {
    push(sig.title);
    push(sig.summary);
  }

  return phrases.filter(Boolean).slice(0, 18);
}

function extractKeywords(signals: MomentCandidate["signals"]): string[] | undefined {
  const kws: string[] = [];
  for (const sig of signals) {
    const arr = (sig as any).keywords;
    if (Array.isArray(arr)) {
      for (const k of arr) {
        const v = String(k ?? "").trim();
        if (v) kws.push(v);
      }
    }
  }
  return kws.length ? kws.slice(0, 24) : undefined;
}

function computeMaturityFromSignals(args: { velocityScore: number; totalSignals: number }): MomentMaturity {
  const v = clamp01(args.velocityScore);
  const n = args.totalSignals;

  if (n < 6 && v >= 0.62) return "emerging";
  if (n >= 6 && v >= 0.52) return "forming";
  if (n >= 12 && v < 0.52) return "established";
  if (v < 0.35) return "expired";
  return "forming";
}
