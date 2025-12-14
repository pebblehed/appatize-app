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

function movementLabelForCluster(scores: number[], createdAtISOs: string[]): string {
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
  return `${heat}${recency}`;
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
  const createdAtISO = typeof raw?.createdAtISO === "string" ? raw.createdAtISO : undefined;

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
};

function addToCluster(cluster: Cluster, item: HnItem) {
  cluster.items.push(item);
  for (const t of item.tokens) {
    cluster.tokenCounts.set(t, (cluster.tokenCounts.get(t) ?? 0) + 1);
  }
  if (item.domain) {
    cluster.domains.set(item.domain, (cluster.domains.get(item.domain) ?? 0) + 1);
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

    // Thresholds:
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

  // Human-readable moment name
  const name = (() => {
    // If we have strong shared tokens, use them
    if (topTokens.length >= 2) {
      const head = topTokens.slice(0, 3).join(" ");
      switch (cluster.category) {
        case "ai":
          return `AI tooling and model capability shifts: ${head}`;
        case "security":
          return `Security pressure is rising: ${head}`;
        case "devtools":
          return `Developer workflow evolution: ${head}`;
        case "web":
          return `Web platform changes surfacing: ${head}`;
        case "data":
          return `Data and performance focus: ${head}`;
        case "startup":
          return `Startup/operator chatter: ${head}`;
        default:
          return `Emerging tech signal: ${head}`;
      }
    }

    // Fallback: derive from first title
    const first = cluster.items[0]?.title ?? `Moment ${index + 1}`;
    return first.length > 72 ? `${first.slice(0, 69)}…` : first;
  })();

  // "Why now" description (short + interpretive)
  const description = (() => {
    const parts: string[] = [];

    // What this cluster is "about"
    switch (cluster.category) {
      case "ai":
        parts.push("Why now: multiple AI-related posts clustering together signals active iteration and adoption pressure.");
        break;
      case "security":
        parts.push("Why now: security topics clustering together signals rising concern and implementation urgency.");
        break;
      case "devtools":
        parts.push("Why now: devtools chatter clustering suggests workflow friction points are being actively solved right now.");
        break;
      case "web":
        parts.push("Why now: web/platform posts clustering indicates shipped changes or new behaviour being noticed in the wild.");
        break;
      case "data":
        parts.push("Why now: data/performance themes clustering suggests teams are optimising systems under real constraints.");
        break;
      case "startup":
        parts.push("Why now: operator/startup themes clustering suggests market or builder behaviour is shifting.");
        break;
      default:
        parts.push("Why now: multiple related signals clustering suggests a real-time theme, not a single headline.");
        break;
    }

    // Add provenance (not a link): source + domain + examples
    parts.push(`Signal: HN cluster · ${cluster.items.length} items${topDomain ? ` · common source domains incl. ${topDomain}` : ""}.`);

    if (sampleTitles.length > 0) {
      parts.push(`Examples: ${sampleTitles.join(" · ")}.`);
    }

    return parts.join(" ");
  })();

  const movement = movementLabelForCluster(cluster.scores, cluster.createdAtISOs);

  // Stable ID from category + top tokens
  const idSeed = `${cluster.category}|${topTokens.join(",")}|${topDomain ?? ""}`;
  const id = `hn:moment:${hashString(idSeed)}`;

  return {
    id,
    status: "emerging",
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
    const hn = await safeFetchJson(`${origin}/api/signals/hn`);

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
    const clusters = clusterItems(items, maxClusters);

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
