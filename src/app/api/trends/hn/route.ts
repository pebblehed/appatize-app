// src/app/api/trends/hn/route.ts
//
// Stage D — HN Trend adapter (LIVE, primary)
// Purpose: turn raw HN items into "moment-like" trends (clustered signals).
//
// Rules:
// - Never 500
// - Always return { trends: [] } at minimum
// - Not a news aggregator: we detect moments, not list headlines.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ApiTrend = {
  id: string;
  status?: string;
  name: string;
  description: string;
  formatLabel?: string;
  momentumLabel?: string;
  category?: string;
};

type TrendsApiResponse = {
  source?: string;
  status?: string;
  count?: number;
  trends: ApiTrend[];
  message?: string;
};

/**
 * Make absolute URL from the current request origin.
 * Prevents hardcoding localhost and works on Vercel/Render.
 */
function buildOriginFromRequest(request: Request): string {
  try {
    const u = new URL(request.url);
    return u.origin;
  } catch {
    return "http://localhost:3000";
  }
}

async function safeFetchJson(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function hostnameFromUrl(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function classifyCategory(title: string, url: string): string {
  const t = `${title} ${url}`.toLowerCase();

  if (t.match(/\b(ai|llm|gpt|model|agent|diffusion|transformer)\b/)) return "ai";
  if (t.match(/\b(security|jwt|oauth|vuln|cve|owasp|attack)\b/))
    return "security";
  if (t.match(/\b(database|postgres|mysql|sqlite|index|query)\b/)) return "data";
  if (t.match(/\b(android|ios|iphone|pixel|mobile)\b/)) return "mobile";
  if (t.match(/\b(chrome|browser|web|http|hls|css|react|next)\b/)) return "web";
  if (t.match(/\b(devtools|cli|sdk|api|framework|library)\b/))
    return "devtools";
  if (t.match(/\b(startup|founder|funding|yc|pricing|saas)\b/))
    return "startup";

  return "technology";
}

/**
 * Very small, deterministic tokeniser for clustering.
 * No ML, no external libs. Stable and predictable.
 */
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
  "part",
  "top",
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
 * Clean an HN-style title so it's usable as a "moment" name.
 * Deterministic and non-speculative.
 */
function cleanTitleForName(rawTitle: string): string {
  let t = (rawTitle || "").trim();

  // Strip common HN prefixes
  t = t.replace(/^(show\s+hn|ask\s+hn|launch\s+hn)\s*:\s*/i, "");

  // Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();

  // Hard cap (keep readable in UI)
  if (t.length > 80) t = `${t.slice(0, 77)}…`;

  return t;
}

function isGenericName(name: string): boolean {
  const n = (name || "").toLowerCase().trim();
  if (!n) return true;
  if (n.length < 12) return true;

  const generic = [
    "emerging tech signal",
    "developer workflow evolution",
    "security pressure is rising",
    "ai tooling and model capability shifts",
    "web platform changes surfacing",
    "data and performance focus",
    "startup/operator chatter",
    "moment",
    "trend",
  ];

  return generic.some((g) => n.startsWith(g));
}

function tokensFor(title: string, url: string): string[] {
  const domain = hostnameFromUrl(url);
  const raw = normalizeText(`${title} ${domain}`);
  const toks = raw
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 3 && t.length <= 24)
    .filter((t) => !STOPWORDS.has(t));

  // De-dupe while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of toks) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function safeNumber(n: any): number | null {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return x;
}

function minutesSince(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const ms = Date.now() - t;
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round(ms / 60000));
}

function movementLabelForCluster(
  scores: number[],
  createdAtISOs: string[],
  confidenceBucket?: "low" | "med" | "high"
): string {
  const maxScore = scores.length ? Math.max(...scores) : 0;

  // Use best recency among cluster items
  const mins: number[] = [];
  for (const iso of createdAtISOs) {
    const m = minutesSince(iso);
    if (m !== null) mins.push(m);
  }
  const bestMins = mins.length ? Math.min(...mins) : null;

  const heat = maxScore >= 50 ? "Hot" : maxScore >= 15 ? "Rising" : "New";
  const recency =
    bestMins === null
      ? ""
      : bestMins < 60
      ? " · <1h"
      : bestMins < 240
      ? " · today"
      : "";

  const confTag =
    confidenceBucket === "high"
      ? " · conf high"
      : confidenceBucket === "med"
      ? " · conf med"
      : confidenceBucket === "low"
      ? " · conf low"
      : "";

  return `${heat}${recency}${confTag}`;
}

/**
 * Simple stable hash for IDs (no crypto needed).
 */
function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // unsigned 32-bit → base36
  return (h >>> 0).toString(36);
}

type HnItem = {
  id: string;
  title: string;
  url: string;
  author: string;
  score: number | null;
  createdAtISO?: string;
  category: string;
  tokens: string[];
  domain: string;
};

function asHnItem(raw: any): HnItem | null {
  const title = typeof raw?.title === "string" ? raw.title.trim() : "";
  if (!title) return null;

  const id = typeof raw?.id === "string" ? raw.id : `hn:${hashString(title)}`;
  const url = typeof raw?.url === "string" ? raw.url : "";
  const author = typeof raw?.author === "string" ? raw.author : "";
  const score = safeNumber(raw?.score);
  const createdAtISO =
    typeof raw?.createdAtISO === "string" ? raw.createdAtISO : undefined;

  const category = classifyCategory(title, url);
  const domain = url ? hostnameFromUrl(url) : "";
  const tokens = tokensFor(title, url);

  return {
    id,
    title,
    url,
    author,
    score,
    createdAtISO,
    category,
    tokens,
    domain,
  };
}

type Cluster = {
  category: string;
  items: HnItem[];
  tokenCounts: Map<string, number>;
  domains: Map<string, number>;
  scores: number[];
  createdAtISOs: string[];
  authors: Map<string, number>;
};

function addToCluster(cluster: Cluster, item: HnItem) {
  cluster.items.push(item);
  for (const t of item.tokens) {
    cluster.tokenCounts.set(t, (cluster.tokenCounts.get(t) ?? 0) + 1);
  }
  if (item.domain) {
    cluster.domains.set(item.domain, (cluster.domains.get(item.domain) ?? 0) + 1);
  }
  if (item.author) {
    cluster.authors.set(item.author, (cluster.authors.get(item.author) ?? 0) + 1);
  }
  if (typeof item.score === "number") cluster.scores.push(item.score);
  if (item.createdAtISO) cluster.createdAtISOs.push(item.createdAtISO);
}

/**
 * Cluster logic:
 * - Primary key: category
 * - Similarity: Jaccard token overlap
 * - Guard: never merge if similarity is too low
 */
function clusterItems(items: HnItem[], maxClusters: number): Cluster[] {
  const clusters: Cluster[] = [];

  for (const item of items) {
    // Try to place into best cluster in same category
    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      if (c.category !== item.category) continue;

      // Compare against cluster "centroid": top tokens
      const centroidTokens = [...c.tokenCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([t]) => t);

      const sim = jaccard(item.tokens, centroidTokens);
      if (sim > bestScore) {
        bestScore = sim;
        bestIdx = i;
      }
    }

    // Threshold:
    // - If same category and shares enough vocabulary, merge.
    // - Otherwise start a new cluster.
    const SHOULD_MERGE = bestIdx >= 0 && bestScore >= 0.22;

    if (SHOULD_MERGE) {
      addToCluster(clusters[bestIdx], item);
    } else {
      const c: Cluster = {
        category: item.category,
        items: [],
        tokenCounts: new Map(),
        domains: new Map(),
        scores: [],
        createdAtISOs: [],
        authors: new Map(),
      };
      addToCluster(c, item);
      clusters.push(c);
    }
  }

  // Sort clusters by "signal weight": max score, then size
  clusters.sort((a, b) => {
    const aMax = a.scores.length ? Math.max(...a.scores) : 0;
    const bMax = b.scores.length ? Math.max(...b.scores) : 0;
    if (bMax !== aMax) return bMax - aMax;
    return b.items.length - a.items.length;
  });

  return clusters.slice(0, maxClusters);
}

function centroidTokensForCluster(cluster: Cluster, n: number): string[] {
  return [...cluster.tokenCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t);
}

/**
 * Second-pass merge to reduce near-duplicate moments.
 * Bounded: only merges within same category using token centroid similarity.
 */
function mergeNearDuplicateClusters(clusters: Cluster[]): Cluster[] {
  const out: Cluster[] = [];

  for (const c of clusters) {
    let merged = false;

    const cCentroid = centroidTokensForCluster(c, 12);

    for (let i = 0; i < out.length; i++) {
      const existing = out[i];
      if (existing.category !== c.category) continue;

      const eCentroid = centroidTokensForCluster(existing, 12);
      const sim = jaccard(cCentroid, eCentroid);

      // High overlap ⇒ same moment
      if (sim >= 0.55) {
        for (const item of c.items) addToCluster(existing, item);
        merged = true;
        break;
      }
    }

    if (!merged) out.push(c);
  }

  // Re-sort by max score, then size
  out.sort((a, b) => {
    const aMax = a.scores.length ? Math.max(...a.scores) : 0;
    const bMax = b.scores.length ? Math.max(...b.scores) : 0;
    if (bMax !== aMax) return bMax - aMax;
    return b.items.length - a.items.length;
  });

  return out;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function sigmoid(x: number): number {
  // bounded, stable
  const z = clamp(x, -10, 10);
  return 1 / (1 + Math.exp(-z));
}

function computeClusterCohesion(cluster: Cluster): number {
  // Cohesion = avg overlap of items with centroid tokens (0–1)
  const centroid = centroidTokensForCluster(cluster, 12);
  if (centroid.length === 0 || cluster.items.length === 0) return 0;

  let sum = 0;
  let count = 0;
  for (const it of cluster.items) {
    if (!it.tokens?.length) continue;
    sum += jaccard(it.tokens, centroid);
    count += 1;
  }
  if (count === 0) return 0;
  return clamp01(sum / count);
}

function computeClusterConfidence(cluster: Cluster): number {
  // Evidence components derived ONLY from the cluster (no new sources).
  const size = cluster.items.length;
  const maxScore = cluster.scores.length ? Math.max(...cluster.scores) : 0;
  const uniqueAuthors = cluster.authors.size;
  const uniqueDomains = cluster.domains.size;

  // Recency: use best (most recent) item
  const mins: number[] = [];
  for (const iso of cluster.createdAtISOs) {
    const m = minutesSince(iso);
    if (m !== null) mins.push(m);
  }
  const bestMins = mins.length ? Math.min(...mins) : null;

  // Freshness: soft decay over 24h, but never collapses to 0
  const freshness = bestMins === null ? 0.6 : clamp01(1 - bestMins / (24 * 60));
  const freshnessSoft = 0.55 + 0.45 * freshness;

  // Cohesion: do these items actually belong together?
  const cohesion = computeClusterCohesion(cluster); // 0–1

  // Evidence: log-ish signals, stable and non-jittery
  const E =
    0.32 * Math.log1p(size) +
    0.20 * Math.log1p(uniqueAuthors) +
    0.18 * Math.log1p(uniqueDomains) +
    0.30 * sigmoid((maxScore - 15) / 10);

  // Quality: cohesion matters
  const Q = 0.35 + 0.65 * cohesion;

  // Combine, clamp
  const raw = clamp01(E * Q) * freshnessSoft;

  // Floor: never below 0.15, cap at 0.98 (prevents fake certainty)
  return clamp(raw, 0.15, 0.98);
}

function statusFromConfidence(conf: number, bestMins: number | null): string {
  // Keep output within the existing status string contract.
  // Deterministic mapping: emerging / peaking / stable
  if (conf >= 0.72 && (bestMins === null || bestMins <= 240)) return "peaking";
  if (conf >= 0.62) return "stable";
  return "emerging";
}

function confidenceBucket(conf: number): "low" | "med" | "high" {
  if (conf >= 0.72) return "high";
  if (conf >= 0.50) return "med";
  return "low";
}

/**
 * Turn a cluster into a "moment-like" trend:
 * - name: readable moment title
 * - description: why it matters now (short, interpretive)
 * No URLs. No outbound behaviour. This is not a news app.
 */
function clusterToTrend(cluster: Cluster, index: number): ApiTrend {
  const topTokens = [...cluster.tokenCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  const topDomain = [...cluster.domains.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)
    .map(([d]) => d)[0];

  const sampleTitles = cluster.items
    .slice(0, 2)
    .map((i) => i.title)
    .filter(Boolean);

  // Compute confidence + status deterministically (no schema changes)
  const conf = computeClusterConfidence(cluster);

  const mins: number[] = [];
  for (const iso of cluster.createdAtISOs) {
    const m = minutesSince(iso);
    if (m !== null) mins.push(m);
  }
  const bestMins = mins.length ? Math.min(...mins) : null;

  const status = statusFromConfidence(conf, bestMins);
  const confBucket = confidenceBucket(conf);

  // Name: prefer representative cleaned title from highest-signal item
  const name = (() => {
    // Pick representative item by: score desc, then token overlap with centroid
    const centroid = centroidTokensForCluster(cluster, 12);

    const ranked = [...cluster.items].sort((a, b) => {
      const aScore = typeof a.score === "number" ? a.score : 0;
      const bScore = typeof b.score === "number" ? b.score : 0;
      if (bScore !== aScore) return bScore - aScore;

      const aSim = jaccard(a.tokens, centroid);
      const bSim = jaccard(b.tokens, centroid);
      if (bSim !== aSim) return bSim - aSim;

      return (b.title?.length ?? 0) - (a.title?.length ?? 0);
    });

    const candidate = cleanTitleForName(ranked[0]?.title ?? "");
    if (candidate && !isGenericName(candidate)) return candidate;

    // Fallback: token-based name (bounded, non-speculative)
    const head = topTokens.slice(0, 3).join(" ");
    if (head) {
      switch (cluster.category) {
        case "ai":
          return `AI moment: ${head}`;
        case "security":
          return `Security moment: ${head}`;
        case "devtools":
          return `Devtools moment: ${head}`;
        case "web":
          return `Web moment: ${head}`;
        case "data":
          return `Data moment: ${head}`;
        case "startup":
          return `Startup moment: ${head}`;
        default:
          return `Tech moment: ${head}`;
      }
    }

    // Last fallback: first title trimmed
    const first = cleanTitleForName(cluster.items[0]?.title ?? `Moment ${index + 1}`);
    return first || `Moment ${index + 1}`;
  })();

  // "Why now" description (short + interpretive, deterministic)
  const description = (() => {
    const parts: string[] = [];

    // Interpretive frame by category (keep it short)
    switch (cluster.category) {
      case "ai":
        parts.push("Why now: clustered AI signals suggest active iteration and adoption pressure.");
        break;
      case "security":
        parts.push("Why now: clustered security signals suggest rising concern and implementation urgency.");
        break;
      case "devtools":
        parts.push("Why now: clustered devtools signals suggest workflow friction is being actively solved.");
        break;
      case "web":
        parts.push("Why now: clustered web/platform signals suggest shipped changes are being noticed in the wild.");
        break;
      case "data":
        parts.push("Why now: clustered data/perf signals suggest teams are optimizing under real constraints.");
        break;
      case "startup":
        parts.push("Why now: clustered operator signals suggest builder behavior or market posture is shifting.");
        break;
      default:
        parts.push("Why now: multiple related signals clustering suggests a real-time theme, not a single headline.");
        break;
    }

    // Provenance (not links)
    parts.push(
      `Signal: HN cluster · ${cluster.items.length} items` +
        (topDomain ? ` · common domains incl. ${topDomain}` : "") +
        `.`
    );

    if (sampleTitles.length > 0) {
      const ex = sampleTitles.map(cleanTitleForName).filter(Boolean).join(" · ");
      if (ex) parts.push(`Examples: ${ex}.`);
    }

    return parts.join(" ");
  })();

  const movement = movementLabelForCluster(
    cluster.scores,
    cluster.createdAtISOs,
    confBucket
  );

  // Stable ID from category + top tokens + top domain (deterministic)
  const idSeed = `${cluster.category}|${topTokens.join(",")}|${topDomain ?? ""}`;
  const id = `hn:moment:${hashString(idSeed)}`;

  return {
    id,
    status,
    name,
    description,
    formatLabel: "HN",
    momentumLabel: movement,
    category: cluster.category || "technology",
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");

    const limit = (() => {
      const n = Number(limitParam ?? 20);
      if (!Number.isFinite(n)) return 20;
      return Math.max(1, Math.min(30, Math.floor(n)));
    })();

    const origin = buildOriginFromRequest(request);
    const hn = await safeFetchJson(
    `${origin}/api/signals/hn?limit=${Math.min(30, limit)}`
    );

    const status = hn?.status;
    const rawItems = Array.isArray(hn?.items) ? hn.items : [];

    if (!hn || status !== "ok") {
      const payload: TrendsApiResponse = {
        source: "hn",
        status: "unavailable",
        count: 0,
        trends: [],
        message: "HN feed unavailable right now.",
      };
      return NextResponse.json(payload, { status: 200 });
    }

    // 1) Normalise items defensively
    const items: HnItem[] = rawItems
      .slice(0, limit)
      .map(asHnItem)
      .filter(Boolean) as HnItem[];

    if (items.length === 0) {
      const payload: TrendsApiResponse = {
        source: "hn",
        status: "ok",
        count: 0,
        trends: [],
        message: "HN returned no usable items.",
      };
      return NextResponse.json(payload, { status: 200 });
    }

    // 2) Cluster into moments (5–8 target)
    const maxClusters = Math.max(5, Math.min(8, Math.ceil(items.length / 3)));
    const clustered = clusterItems(items, maxClusters);

    // 2.1) Merge near-duplicates (bounded)
    const clusters = mergeNearDuplicateClusters(clustered).slice(0, maxClusters);

    // 3) Convert clusters into moment-like trends
    const trends = clusters.map((c, i) => clusterToTrend(c, i));

    const payload: TrendsApiResponse = {
      source: "hn",
      status: "ok",
      count: trends.length,
      trends,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    // Hard rule: never 500
    console.error("[/api/trends/hn] Unhandled error", err);
    const payload: TrendsApiResponse = {
      source: "hn",
      status: "unavailable",
      count: 0,
      trends: [],
      message: "HN trends unavailable right now.",
    };
    return NextResponse.json(payload, { status: 200 });
  }
}
