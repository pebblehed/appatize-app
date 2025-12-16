import { clamp01 } from "../../contracts/MOMENT_QUALITY_CONTRACT";

export type TimedSignalLike = {
  createdAt: number | string | Date;
};

export type VelocityOptions = {
  binMs?: number;
  bins?: number;
  recentPortion?: number;
};

export type VelocityResult = {
  score: number;
  totalSignalsUsed: number;
  histogram: number[];
  recentSum: number;
  baselineSum: number;
  recentAvg: number;
  baselineAvg: number;
  ratio: number;
};

export function computeVelocity(
  signals: TimedSignalLike[],
  opts: VelocityOptions = {}
): VelocityResult {
  const binMs = opts.binMs ?? 60 * 60 * 1000;
  const bins = Math.max(4, opts.bins ?? 12);
  const recentPortion = clamp01(opts.recentPortion ?? 0.25);

  const timestamps = normalizeTimestamps(signals);
  if (timestamps.length === 0) {
    return {
      score: 0,
      totalSignalsUsed: 0,
      histogram: Array.from({ length: bins }, () => 0),
      recentSum: 0,
      baselineSum: 0,
      recentAvg: 0,
      baselineAvg: 0,
      ratio: 0,
    };
  }

  const end = Math.max(...timestamps);
  const start = end - bins * binMs;

  const histogram = Array.from({ length: bins }, () => 0);
  let used = 0;

  for (const t of timestamps) {
    if (t < start || t > end) continue;
    const idx = Math.floor((t - start) / binMs);
    if (idx >= 0 && idx < bins) {
      histogram[idx] += 1;
      used += 1;
    }
  }

  const recentBins = Math.max(1, Math.round(bins * recentPortion));
  const baselineBins = bins - recentBins;

  const baselineSlice = histogram.slice(0, baselineBins);
  const recentSlice = histogram.slice(baselineBins);

  const baselineSum = sum(baselineSlice);
  const recentSum = sum(recentSlice);

  const baselineAvg = baselineBins > 0 ? baselineSum / baselineBins : 0;
  const recentAvg = recentBins > 0 ? recentSum / recentBins : 0;

  const safeBaseline = Math.max(0.25, baselineAvg);
  const ratio = recentAvg / safeBaseline;

  const score = clamp01(mapRatioToScore(ratio, recentAvg, used));

  return {
    score,
    totalSignalsUsed: used,
    histogram,
    recentSum,
    baselineSum,
    recentAvg,
    baselineAvg,
    ratio,
  };
}

function normalizeTimestamps(signals: TimedSignalLike[]): number[] {
  if (!Array.isArray(signals) || signals.length === 0) return [];

  const out: number[] = [];
  for (const s of signals) {
    if (!s) continue;
    const t = toMs(s.createdAt);
    if (!Number.isFinite(t)) continue;
    out.push(t);
  }

  out.sort((a, b) => a - b);
  return out;
}

function toMs(v: number | string | Date): number {
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : NaN;
  }
  return NaN;
}

function mapRatioToScore(ratio: number, recentAvg: number, used: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;

  let base: number;
  if (ratio < 1) base = 0.20;
  else if (ratio < 1.5) base = 0.35 + (ratio - 1) * 0.40;
  else if (ratio < 2) base = 0.55 + (ratio - 1.5) * 0.30;
  else if (ratio < 3) base = 0.70 + (ratio - 2) * 0.15;
  else if (ratio < 4) base = 0.85 + (ratio - 3) * 0.10;
  else base = 1.0;

  const activityFactor = clamp01(recentAvg / 2);
  const sampleFactor = clamp01(used / 6);

  const dampened = base * (0.50 + 0.50 * activityFactor) * (0.60 + 0.40 * sampleFactor);
  return clamp01(dampened);
}

function sum(arr: number[]): number {
  let s = 0;
  for (const n of arr) s += n;
  return s;
}
