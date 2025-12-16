// src/app/api/trends/live/route.ts
//
// Stage D.2 — Signal Convergence (LIVE fusion)
// Purpose: fuse multiple sources into "moment-like" clustered trends.
// Sources (today):
//  - HN moments:  /api/trends/hn
//  - Reddit:      /api/signals/reddit?subs=...
//
// Stage D.3 — Intelligence Hardening (Moment Quality) — ACTIVATED
// - Apply Moment Quality Firewall (qualifyMoment) BEFORE returning trends.
// - Hard rules remain: never 500, always { trends: [] } minimum
// - Note: velocity is disabled here until upstream signals carry timestamps
//
// Rules:
// - Never 500
// - Always return { trends: [] } at minimum
// - Not a news aggregator: interpret + cluster into moments
// - No outbound links required; keep descriptions "moment-like"

import { NextResponse } from "next/server";
import { qualifyMoment } from "@internal/mse/quality/qualifyMoment";
import type {
  MomentQualityThresholds,
  MomentQualityWeights,
} from "@internal/contracts/MOMENT_QUALITY_CONTRACT";

export const dynamic = "force-dynamic";

type ApiTrend = {
  id: string;
  status?: string;
  name: string;
  description: string;
  formatLabel?: string;
  momentumLabel?: string;
  category?: string;

  // Optional (future): if upstream provides it, we can re-enable velocity scoring properly.
  // Not required for current clients.
  createdAt?: string;
};

type TrendsApiResponse = {
  source?: string;
  status?: string;
  count?: number;
  trends: ApiTrend[];
  message?: string;
};

function buildOriginFromRequest(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cleanup: () => clearTimeout(t) };
}

async function safeFetchJson(url: string, timeoutMs = 8000) {
  const { signal, cleanup } = withTimeout(timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

/** Deterministic utilities (no libs, stable, predictable) */
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "by",
  "from",
  "as",
  "at",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "into",
  "over",
  "under",
  "about",
  "how",
  "why",
  "what",
  "when",
  "where",
  "your",
  "my",
  "we",
  "you",
  "i",
  "our",
  "their",
  "they",
  "them",
  "via",
  "new",
  "show",
  "hn",
  "reddit",
  "r",
  "top",

  // fusion/meta noise (IMPORTANT)
  "fusion",
  "confirmed",
  "single",
  "source",
  "reinforced",
  "conf",
  "high",
  "med",
  "low",
]);

function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean a trend name for use as a "moment" title.
 * Deterministic: strips obvious prefixes and caps length.
 */
function cleanNameForMoment(raw: string): string {
  let t = (raw || "").trim();

  // Strip common HN prefixes
  t = t.replace(/^(show\s+hn|ask\s+hn|launch\s+hn)\s*:\s*/i, "");

  // Strip our own token-based prefix variants (if they occur)
  t = t.replace(
    /^(ai\s+moment|security\s+moment|devtools\s+moment|web\s+moment|data\s+moment|startup\s+moment|tech\s+moment)\s*:\s*/i,
    ""
  );

  t = t.replace(/\s+/g, " ").trim();
  if (t.length > 84) t = `${t.slice(0, 81)}…`;
  return t;
}

function isGenericMomentName(name: string): boolean {
  const n = (name || "").toLowerCase().trim();
  if (!n || n.length < 12) return true;

  return [
    "emerging moment",
    "ai capability",
    "ai tooling",
    "security pressure",
    "dev workflow shift",
    "web/platform behaviour",
    "data + performance",
    "builder/operator behaviour",
    "tech moment",
    "moment",
    "trend",
  ].some((g) => n.startsWith(g));
}

function tokensForTrend(t: ApiTrend): string[] {
  const raw = normalizeText(`${t.name} ${t.category ?? ""} ${t.formatLabel ?? ""}`);
  const toks = raw
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.length >= 3 && x.length <= 24)
    .filter((x) => !STOPWORDS.has(x));

  // de-dupe preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of toks) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union <= 0 ? 0 : inter / union;
}

function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-clamp(x, -10, 10)));
}

/**
 * Parse momentum labels into a numeric weight.
 * Robust: if it can’t parse, returns 0.
 */
function momentumWeight(label?: string): number {
  const s = (label ?? "").toLowerCase();
  if (!s) return 0;

  const m = s.match(/score\s+(\d+)/);
  if (m?.[1]) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) return Math.min(100, Math.max(0, n / 2));
  }

  if (s.includes("hot")) return 40;
  if (s.includes("rising")) return 25;
  if (s.includes("new")) return 10;
  return 0;
}

type SourceTag = "HN" | "Reddit";

type TrendItem = {
  source: SourceTag;
  trend: ApiTrend;
  tokens: string[];
  weight: number;
};

type Cluster = {
  items: TrendItem[];
  tokenCounts: Map<string, number>;
  sources: Map<SourceTag, number>;
  categories: Map<string, number>;
  weightMax: number;
};

function newCluster(): Cluster {
  return {
    items: [],
    tokenCounts: new Map(),
    sources: new Map(),
    categories: new Map(),
    weightMax: 0,
  };
}

function addToCluster(c: Cluster, item: TrendItem) {
  c.items.push(item);
  for (const t of item.tokens) {
    c.tokenCounts.set(t, (c.tokenCounts.get(t) ?? 0) + 1);
  }
  c.sources.set(item.source, (c.sources.get(item.source) ?? 0) + 1);

  const cat = item.trend.category || "technology";
  c.categories.set(cat, (c.categories.get(cat) ?? 0) + 1);

  c.weightMax = Math.max(c.weightMax, item.weight);
}

function dominantCategory(c: Cluster): string {
  return (
    [...c.categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "technology"
  );
}

function topTokens(c: Cluster, n: number): string[] {
  return [...c.tokenCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t);
}

function clusterCohesion(c: Cluster): number {
  const cent = topTokens(c, 12);
  if (!cent.length || !c.items.length) return 0;

  let sum = 0;
  let count = 0;
  for (const it of c.items) {
    if (!it.tokens?.length) continue;
    sum += jaccard(it.tokens, cent);
    count++;
  }
  return count ? clamp01(sum / count) : 0;
}

/**
 * Cluster logic:
 * - cluster by token overlap across sources
 * - deterministic threshold (0.22)
 */
function clusterTrends(items: TrendItem[], maxClusters: number): Cluster[] {
  const clusters: Cluster[] = [];

  for (const item of items) {
    let bestIdx = -1;
    let bestSim = 0;

    for (let i = 0; i < clusters.length; i++) {
      const sim = jaccard(item.tokens, topTokens(clusters[i], 12));
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestSim >= 0.22) {
      addToCluster(clusters[bestIdx], item);
    } else {
      const c = newCluster();
      addToCluster(c, item);
      clusters.push(c);
    }
  }

  // Prefer multi-source, then weight, then size
  clusters.sort((a, b) => {
    if (b.sources.size !== a.sources.size) return b.sources.size - a.sources.size;
    if (b.weightMax !== a.weightMax) return b.weightMax - a.weightMax;
    return b.items.length - a.items.length;
  });

  return clusters.slice(0, maxClusters);
}

/**
 * Second-pass merge to reduce near-duplicate fused moments.
 * Bounded: same dominant category + high centroid overlap.
 */
function mergeNearDuplicateClusters(clusters: Cluster[]): Cluster[] {
  const out: Cluster[] = [];

  for (const c of clusters) {
    let merged = false;
    const cCent = topTokens(c, 12);
    const cCat = dominantCategory(c);

    for (const e of out) {
      if (dominantCategory(e) !== cCat) continue;
      if (jaccard(cCent, topTokens(e, 12)) >= 0.55) {
        for (const it of c.items) addToCluster(e, it);
        merged = true;
        break;
      }
    }

    if (!merged) out.push(c);
  }

  // re-sort after merges
  out.sort((a, b) => {
    if (b.sources.size !== a.sources.size) return b.sources.size - a.sources.size;
    if (b.weightMax !== a.weightMax) return b.weightMax - a.weightMax;
    return b.items.length - a.items.length;
  });

  return out;
}

function computeClusterConfidence(c: Cluster): number {
  const cohesion = clusterCohesion(c); // 0..1
  const reinforce = c.sources.size >= 2 ? 1.12 : 1.0;

  const E =
    0.28 * Math.log1p(c.items.length) +
    0.32 * sigmoid((c.weightMax - 15) / 10) +
    0.24 * (0.55 + 0.45 * cohesion);

  return clamp(clamp01(E * reinforce), 0.15, 0.98);
}

function confidenceBucket(conf: number): "low" | "med" | "high" {
  if (conf >= 0.72) return "high";
  if (conf >= 0.5) return "med";
  return "low";
}

/**
 * Pick a representative name deterministically:
 * weight desc → similarity to centroid → shorter cleaned name.
 */
function bestRepresentativeName(c: Cluster): string {
  const cent = topTokens(c, 12);

  const ranked = [...c.items].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;

    const aSim = jaccard(a.tokens, cent);
    const bSim = jaccard(b.tokens, cent);
    if (bSim !== aSim) return bSim - aSim;

    const aLen = (a.trend?.name ?? "").length;
    const bLen = (b.trend?.name ?? "").length;
    return aLen - bLen;
  });

  return cleanNameForMoment(ranked[0]?.trend?.name ?? "");
}

function clusterName(c: Cluster): string {
  const rep = bestRepresentativeName(c);
  if (rep && !isGenericMomentName(rep)) return rep;

  // token fallback (bounded)
  const head = topTokens(c, 3).join(" ");
  return head ? `Emerging moment: ${head}` : "Emerging moment";
}

function clusterDescription(c: Cluster): string {
  const cat = dominantCategory(c);
  const examples = c.items
    .slice(0, 2)
    .map((x) => cleanNameForMoment(x.trend.name))
    .filter(Boolean);

  const src = [...c.sources.entries()].map(([k, v]) => `${k} ${v}`).join(", ");

  const bits: string[] = [];
  bits.push(`Why now: ${cat} signals clustering suggests real-time convergence.`);
  bits.push(`Signals: ${src}.`);
  if (examples.length) bits.push(`Examples: ${examples.join(" · ")}.`);
  return bits.join(" ");
}

function clusterToTrend(c: Cluster): ApiTrend {
  const conf = computeClusterConfidence(c);
  const bucket = confidenceBucket(conf);

  const sourcesKey = [...c.sources.keys()].sort().join("+");
  const seed = `${dominantCategory(c)}|${topTokens(c, 8).join(",")}|${sourcesKey}`;
  const id = `live:moment:${hashString(seed)}`;

  const status = conf >= 0.72 ? "peaking" : conf >= 0.62 ? "stable" : "emerging";

  const confirmed = c.sources.size >= 2;
  const movementBase = c.weightMax >= 40 ? "Hot" : c.weightMax >= 20 ? "Rising" : "New";
  const movement = `${movementBase}${confirmed ? " · reinforced" : ""} · conf ${bucket}`;

  return {
    id,
    status,
    name: clusterName(c),
    description: clusterDescription(c),
    formatLabel: `FUSION · ${confirmed ? "Confirmed" : "Single-source"}`,
    momentumLabel: movement,
    category: dominantCategory(c),
  };
}

function asApiTrend(raw: any): ApiTrend | null {
  const name = typeof raw?.name === "string" ? raw.name.trim() : "";
  const description = typeof raw?.description === "string" ? raw.description.trim() : "";
  if (!name || !description) return null;

  const id =
    typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : `t:${hashString(name)}`;

  // Optional: accept createdAt if upstream provides it (future velocity enablement).
  const createdAt =
    typeof raw?.createdAt === "string" && raw.createdAt.trim() ? raw.createdAt.trim() : undefined;

  return {
    id,
    status: typeof raw?.status === "string" ? raw.status : undefined,
    name,
    description,
    formatLabel: typeof raw?.formatLabel === "string" ? raw.formatLabel : undefined,
    momentumLabel: typeof raw?.momentumLabel === "string" ? raw.momentumLabel : undefined,
    category: typeof raw?.category === "string" ? raw.category : undefined,
    createdAt,
  };
}

/**
 * Stage D.3 Activation: Moment Quality settings for this route.
 * Velocity is disabled until upstream signals carry reliable timestamps.
 */
const D3_WEIGHTS_NO_VELOCITY: MomentQualityWeights = {
  signalDensity: 0.34,
  velocity: 0.0,
  narrativeCoherence: 0.33,
  culturalLegibility: 0.33,
};

const D3_THRESHOLDS_NO_VELOCITY: MomentQualityThresholds = {
  minOverall: 0.68,
  minSignalDensity: 0.55,
  minVelocity: 0.0, // velocity disabled here
  minNarrativeCoherence: 0.55,
  minCulturalLegibility: 0.5,
  minUniqueSources: 2,
  minTotalSignals: 4,
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const limit = (() => {
      const n = Number(searchParams.get("limit") ?? 20);
      if (!Number.isFinite(n)) return 20;
      return Math.max(1, Math.min(30, Math.floor(n)));
    })();

    // Optional: allow caller to override reddit subs
    const redditSubs = (searchParams.get("redditSubs") ?? "socialmedia,marketing").trim();

    const origin = buildOriginFromRequest(request);

    const hnJson = await safeFetchJson(`${origin}/api/trends/hn?limit=${Math.min(30, limit)}`);
    const rdJson = await safeFetchJson(
      `${origin}/api/signals/reddit?subs=${encodeURIComponent(redditSubs)}`
    );

    const hnTrendsRaw = Array.isArray(hnJson?.trends) ? hnJson.trends : [];
    const rdTrendsRaw = Array.isArray(rdJson?.trends) ? rdJson.trends : [];

    const hnTrends = hnTrendsRaw.map(asApiTrend).filter(Boolean) as ApiTrend[];
    const rdTrends = rdTrendsRaw.map(asApiTrend).filter(Boolean) as ApiTrend[];

    // If everything is down, return empty-but-safe with a clear status
    if (hnTrends.length === 0 && rdTrends.length === 0) {
      const payload: TrendsApiResponse = {
        source: "live-fusion",
        status: "unavailable",
        count: 0,
        trends: [],
        message: "Live fusion unavailable right now (HN + Reddit).",
      };
      return NextResponse.json(payload, { status: 200 });
    }

    // Normalize to TrendItems
    const items: TrendItem[] = [];

    for (const t of hnTrends) {
      items.push({
        source: "HN",
        trend: t,
        tokens: tokensForTrend(t),
        weight: momentumWeight(t.momentumLabel),
      });
    }

    for (const t of rdTrends) {
      items.push({
        source: "Reddit",
        trend: t,
        tokens: tokensForTrend(t),
        weight: momentumWeight(t.momentumLabel),
      });
    }

    // Cluster into moments (target 6–10), bounded
    const maxClusters = Math.max(6, Math.min(10, Math.ceil(items.length / 3)));
    const clustered = clusterTrends(items, maxClusters);
    const clusters = mergeNearDuplicateClusters(clustered).slice(0, maxClusters);

    // Stage D.3 Activation:
    // - qualify each cluster as a moment candidate
    // - only pass-qualified moments are returned
    const qualifiedTrends: ApiTrend[] = [];

    // ✅ deterministic per-request fallback timestamp (so createdAt is never undefined)
    const nowIso = new Date().toISOString();

    for (const c of clusters) {
      const t = clusterToTrend(c);

      // Build candidate signals from the cluster items (deterministic).
      // createdAt must be present per TimedSignalLike; fallback to nowIso if absent.
      const signals = c.items.map((it) => ({
        source: it.source === "HN" ? "hn" : "reddit",
        createdAt: it.trend.createdAt ?? nowIso,
        title: it.trend.name,
        summary: it.trend.description,
        keywords: it.tokens,
      }));

      const q = qualifyMoment(
        {
          id: t.id,
          signals,
          title: t.name,
          description: t.description,
          keywords: topTokens(c, 10),
          // optional provenance fields reserved for later:
          firstSeenAt: undefined,
          collapsedFromIds: undefined,
        },
        {
          weights: D3_WEIGHTS_NO_VELOCITY,
          thresholds: D3_THRESHOLDS_NO_VELOCITY,
        }
      );

      if (q.pass) {
        qualifiedTrends.push(t);
      }
    }

    const trends = qualifiedTrends.slice(0, limit);

    const payload: TrendsApiResponse = {
      source: "live-fusion",
      status: "ok",
      count: trends.length,
      trends,
      message: trends.length === 0 ? "No qualified fused moments were detected right now." : undefined,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    // Hard rule: never 500
    console.error("[/api/trends/live] Unhandled error", err);
    const payload: TrendsApiResponse = {
      source: "live-fusion",
      status: "unavailable",
      count: 0,
      trends: [],
      message: "Live fusion trends unavailable right now.",
    };
    return NextResponse.json(payload, { status: 200 });
  }
}
