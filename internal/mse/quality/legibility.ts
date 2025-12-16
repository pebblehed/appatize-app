import { clamp01 } from "../../contracts/MOMENT_QUALITY_CONTRACT";

export type LegibilityInput = {
  text: string;
  phrases?: string[];
};

export type LegibilityResult = {
  score: number;
  stats: {
    charLen: number;
    wordCount: number;
    avgWordLen: number;
    longWordRatio: number;
    allCapsRatio: number;
    digitRatio: number;
    jargonHits: number;
    jargonRatio: number;
  };
};

export function computeCulturalLegibility(input: LegibilityInput): LegibilityResult {
  const baseText = (input.text ?? "").trim();
  const phrases = Array.isArray(input.phrases) ? input.phrases : [];
  const combined = compactText([baseText, ...phrases].filter(Boolean).join(" | "));

  const tokens = tokenize(combined);
  const wordTokens = tokens.filter((t) => isWordLike(t));

  const charLen = combined.length;
  const wordCount = wordTokens.length;

  if (!combined || wordCount === 0) {
    return {
      score: 0,
      stats: {
        charLen,
        wordCount: 0,
        avgWordLen: 0,
        longWordRatio: 1,
        allCapsRatio: 1,
        digitRatio: 1,
        jargonHits: 0,
        jargonRatio: 0,
      },
    };
  }

  const avgWordLen = sum(wordTokens.map((w) => w.length)) / wordCount;
  const longWordCount = wordTokens.filter((w) => w.length >= 10).length;
  const longWordRatio = longWordCount / wordCount;

  const allCapsCount = wordTokens.filter((w) => isAllCaps(w) && w.length >= 2).length;
  const allCapsRatio = allCapsCount / wordCount;

  const digitCount = wordTokens.filter((w) => /\d/.test(w)).length;
  const digitRatio = digitCount / wordCount;

  const jargonHits = countJargonHits(wordTokens);
  const jargonRatio = jargonHits / wordCount;

  const lengthScore = scoreLength(wordCount, charLen);
  const complexityPenalty = clamp01(1 - (0.65 * longWordRatio + 0.75 * jargonRatio));
  const soupPenalty = clamp01(1 - (0.70 * allCapsRatio + 0.40 * digitRatio));
  const vocabBonus = clamp01(1.15 - avgWordLen / 8);

  const score = clamp01(
    (0.45 * lengthScore + 0.35 * complexityPenalty + 0.20 * soupPenalty) *
      (0.80 + 0.20 * vocabBonus)
  );

  return {
    score,
    stats: {
      charLen,
      wordCount,
      avgWordLen: round(avgWordLen, 2),
      longWordRatio: round(longWordRatio, 3),
      allCapsRatio: round(allCapsRatio, 3),
      digitRatio: round(digitRatio, 3),
      jargonHits,
      jargonRatio: round(jargonRatio, 3),
    },
  };
}

function compactText(s: string): string {
  const trimmed = s.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 240) return trimmed;
  return trimmed.slice(0, 240);
}

function tokenize(s: string): string[] {
  return s
    .trim()
    .split(/\s+/g)
    .map((t) => t.replace(/[^A-Za-z0-9-]/g, "")) // safe ASCII
    .filter(Boolean);
}

function isWordLike(t: string): boolean {
  return /^[A-Za-z0-9-]+$/.test(t);
}

function isAllCaps(t: string): boolean {
  return /^[A-Z0-9-]+$/.test(t) && /[A-Z]/.test(t);
}

function scoreLength(wordCount: number, charLen: number): number {
  let wcScore: number;
  if (wordCount < 4) wcScore = 0.20;
  else if (wordCount < 8) wcScore = 0.55;
  else if (wordCount <= 22) wcScore = 1.0;
  else if (wordCount <= 30) wcScore = 0.75;
  else wcScore = 0.45;

  const charPenalty = charLen <= 160 ? 1 : clamp01(1 - (charLen - 160) / 200);
  return clamp01(wcScore * (0.70 + 0.30 * charPenalty));
}

function countJargonHits(tokens: string[]): number {
  let hits = 0;

  for (const raw of tokens) {
    const t = raw.toLowerCase();
    if (JARGON.has(t)) hits++;
  }

  const acronymish = tokens.filter((w) => isAllCaps(w) && w.length >= 2).length;
  if (acronymish >= 4) hits += 2;
  if (acronymish >= 6) hits += 3;

  return hits;
}

function sum(nums: number[]): number {
  let s = 0;
  for (const n of nums) s += n;
  return s;
}

function round(n: number, dp: number): number {
  const p = 10 ** dp;
  return Math.round(n * p) / p;
}

const JARGON = new Set([
  "llm","rag","embedding","embeddings","vector","vectors","token","tokens","inference",
  "fine-tune","finetune","finetuning","latency","throughput","gpu","cuda","transformer",
  "diffusion","benchmark","benchmarks","api","sdk","devops","kubernetes","microservices",
  "serverless","observability","telemetry","cryptography","blockchain","web3","defi","nft","tokenomics",
]);
