import { clamp01 } from "../../contracts/MOMENT_QUALITY_CONTRACT";

export type SignalLike = {
  source: string;
  id?: string | number;
};

export type SignalDensityResult = {
  score: number;
  uniqueSources: string[];
  uniqueSourcesCount: number;
  totalSignals: number;
  bySource: Record<string, number>;
};

export function computeSignalDensity(signals: SignalLike[]): SignalDensityResult {
  const normalized = normalizeSignals(signals);

  const totalSignals = normalized.length;
  if (totalSignals === 0) {
    return {
      score: 0,
      uniqueSources: [],
      uniqueSourcesCount: 0,
      totalSignals: 0,
      bySource: {},
    };
  }

  const bySource: Record<string, number> = {};
  for (const s of normalized) {
    const key = canonicalSource(s.source);
    bySource[key] = (bySource[key] ?? 0) + 1;
  }

  const uniqueSources = Object.keys(bySource).sort();
  const uniqueSourcesCount = uniqueSources.length;

  const diversity = clamp01(uniqueSourcesCount / totalSignals);

  const maxCount = Math.max(...Object.values(bySource));
  const dominance = clamp01(maxCount / totalSignals);

  const penaltyFactor = clamp01(1 - (dominance - 0.25));
  const boundedPenalty = clamp01(0.25 + 0.75 * penaltyFactor);

  const score = clamp01(diversity * boundedPenalty);

  return {
    score,
    uniqueSources,
    uniqueSourcesCount,
    totalSignals,
    bySource,
  };
}

function normalizeSignals(signals: SignalLike[]): SignalLike[] {
  if (!Array.isArray(signals) || signals.length === 0) return [];

  const out: SignalLike[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < signals.length; i++) {
    const s = signals[i];
    if (!s || typeof s.source !== "string") continue;

    const source = canonicalSource(s.source);
    const id =
      s.id !== undefined && s.id !== null && String(s.id).trim().length > 0
        ? String(s.id).trim()
        : `idx:${i}`;

    const key = `${source}::${id}`;
    if (seen.has(key)) continue;

    seen.add(key);
    out.push({ source, id });
  }

  return out;
}

function canonicalSource(source: string): string {
  const s = source.trim().toLowerCase();
  if (s === "hackernews" || s === "hacker-news") return "hn";
  if (s === "r" || s === "subreddit") return "reddit";
  return s;
}
