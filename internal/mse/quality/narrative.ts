import { clamp01 } from "../../contracts/MOMENT_QUALITY_CONTRACT";

export type NarrativeInput = {
  phrases: string[];
  keywords?: string[];
};

export type NarrativeResult = {
  score: number;
  coreTokens: string[];
  tokenStats: {
    totalTokens: number;
    uniqueTokens: number;
    noiseRatio: number;
    avgPairwiseJaccard: number;
  };
};

export function computeNarrativeCoherence(input: NarrativeInput): NarrativeResult {
  const phrases = Array.isArray(input.phrases) ? input.phrases : [];
  const keywords = Array.isArray(input.keywords) ? input.keywords : undefined;

  const tokenSets = buildTokenSets(phrases);

  if (tokenSets.length === 0) {
    return {
      score: 0,
      coreTokens: [],
      tokenStats: { totalTokens: 0, uniqueTokens: 0, noiseRatio: 1, avgPairwiseJaccard: 0 },
    };
  }

  const freq = new Map<string, number>();
  for (const set of tokenSets) {
    for (const tok of set) freq.set(tok, (freq.get(tok) ?? 0) + 1);
  }

  const totalTokens = sum(Array.from(freq.values()));
  const uniqueTokens = freq.size;
  const noiseRatio = totalTokens > 0 ? uniqueTokens / totalTokens : 1;

  const minOccur = Math.max(2, Math.ceil(tokenSets.length * 0.35));
  const coreTokens = Array.from(freq.entries())
    .filter(([, c]) => c >= minOccur)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 12);

  const avgPairwiseJaccard = averagePairwiseJaccard(tokenSets);

  const overlapScore = clamp01(avgPairwiseJaccard);
  const compressionScore = clamp01(coreTokens.length / Math.max(4, Math.min(12, uniqueTokens)));

  const noisePenalty = clamp01(1 - (noiseRatio - 0.35));
  const boundedNoise = clamp01(0.25 + 0.75 * noisePenalty);

  let keywordBoost = 1;
  if (keywords && keywords.length > 0 && coreTokens.length > 0) {
    const kw = new Set(keywords.map((k) => normalizeToken(k)).filter(Boolean));
    const core = new Set(coreTokens);
    const overlap = intersectionSize(kw, core);
    const boost = clamp01(overlap / Math.max(3, Math.min(8, coreTokens.length)));
    keywordBoost = 0.90 + 0.10 * boost;
  }

  const score = clamp01((0.50 * overlapScore + 0.35 * compressionScore) * boundedNoise * keywordBoost);

  return {
    score,
    coreTokens,
    tokenStats: {
      totalTokens,
      uniqueTokens,
      noiseRatio: clamp01(noiseRatio),
      avgPairwiseJaccard,
    },
  };
}

function buildTokenSets(phrases: string[]): Array<Set<string>> {
  const out: Array<Set<string>> = [];

  for (const p of phrases) {
    if (!p || typeof p !== "string") continue;

    const tokens = tokenize(p)
      .map(normalizeToken)
      .filter((t) => t.length >= 3)
      .filter((t) => !STOPWORDS.has(t));

    const set = new Set(tokens);
    if (set.size >= 3) out.push(set);
  }

  return out;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[_/\\|]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function normalizeToken(t: string): string {
  let s = (t ?? "").toLowerCase().trim();
  if (!s) return "";
  if (s.endsWith("ing") && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith("ed") && s.length > 4) s = s.slice(0, -2);
  else if (s.endsWith("s") && s.length > 4) s = s.slice(0, -1);
  return s;
}

function averagePairwiseJaccard(sets: Array<Set<string>>): number {
  const n = sets.length;
  if (n < 2) return 0;

  let total = 0;
  let count = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      total += jaccard(sets[i], sets[j]);
      count += 1;
    }
  }

  return count > 0 ? total / count : 0;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = intersectionSize(a, b);
  const uni = a.size + b.size - inter;
  return uni > 0 ? inter / uni : 0;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let c = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const v of small) if (large.has(v)) c++;
  return c;
}

function sum(nums: number[]): number {
  let s = 0;
  for (const n of nums) s += n;
  return s;
}

const STOPWORDS = new Set([
  "the","and","for","with","from","that","this","into","over","about","your","you","our","are",
  "was","were","will","have","has","had","not","but","all","any","can","how","why","what","when",
  "where","who","new","now","just","than","then","more","most","less","very","via","vs","use",
  "using","used","make","made","get","gets","got",
]);
