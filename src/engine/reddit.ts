// src/engine/reddit.ts
//
// Stage 2: Real signal adapter (Reddit) — PRODUCTION-GRADE
// Uses Reddit OAuth + oauth.reddit.com to avoid public endpoint 403 blocking.
//
// Required env vars (server-side only):
// - REDDIT_CLIENT_ID
// - REDDIT_CLIENT_SECRET
// - REDDIT_USER_AGENT
//
// Notes:
// - Uses "client_credentials" for app-only read access (sufficient for hot listings).
// - Caches token in memory to avoid fetching a token on every request.
// - If env vars are missing, we throw loudly. No silent fallbacks.
//
// Stage D Hardening (bounded):
// - Cluster posts into "moment-like" TrendSignal[] (deterministic token overlap)
// - Improve naming stability and reduce duplicates
// - Keep contracts and upstream shapes unchanged

import type { SignalEvent, TrendSignal } from "@/engine/trends";
import { interpretTrendSignals } from "@/engine/trends";

type RedditTokenCache = {
  accessToken: string;
  expiresAtMs: number; // epoch ms
};

let tokenCache: RedditTokenCache | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(
      `[RedditAdapter] Missing required env var: ${name}. Reddit OAuth is required (no public JSON).`
    );
  }
  return String(v).trim();
}

function makeAbortSignal(timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cancel: () => clearTimeout(t) };
}

/**
 * Fetch an app-only OAuth token from Reddit.
 * Uses client_credentials (server-side only).
 */
async function getRedditAccessToken(): Promise<string> {
  const now = Date.now();

  // If cached token is still valid (with 30s safety buffer), reuse.
  if (tokenCache && tokenCache.expiresAtMs - 30_000 > now) {
    return tokenCache.accessToken;
  }

  const clientId = requireEnv("REDDIT_CLIENT_ID");
  const clientSecret = requireEnv("REDDIT_CLIENT_SECRET");
  const userAgent = requireEnv("REDDIT_USER_AGENT");

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");

  const { signal, cancel } = makeAbortSignal(12_000);

  try {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "User-Agent": userAgent,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `[RedditAdapter] OAuth token request failed: ${res.status} ${res.statusText}. ${text.slice(
          0,
          200
        )}`
      );
    }

    const json = (await res.json()) as any;
    const accessToken = typeof json?.access_token === "string" ? json.access_token : "";
    const expiresIn = typeof json?.expires_in === "number" ? json.expires_in : 0;

    if (!accessToken || !expiresIn) {
      throw new Error(
        `[RedditAdapter] OAuth token response missing fields. access_token/expires_in not present.`
      );
    }

    tokenCache = {
      accessToken,
      expiresAtMs: now + expiresIn * 1000,
    };

    return accessToken;
  } finally {
    cancel();
  }
}

/**
 * Fetch hot posts from a subreddit using OAuth-protected endpoint.
 */
export async function fetchRedditHotSignals(
  subreddit: string,
  limit: number = 15
): Promise<SignalEvent[]> {
  const userAgent = requireEnv("REDDIT_USER_AGENT");
  const token = await getRedditAccessToken();

  // oauth endpoint (NOT www.reddit.com)
  const url = `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/hot?limit=${limit}`;

  const { signal, cancel } = makeAbortSignal(12_000);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": userAgent,
        Accept: "application/json",
      },
      cache: "no-store",
      signal,
    });

    if (!res.ok) {
      // If token expired unexpectedly, clear cache once (next call will re-auth).
      if (res.status === 401) tokenCache = null;

      console.error(
        `[RedditAdapter] Failed to fetch /r/${subreddit}/hot: ${res.status} ${res.statusText}`
      );
      return [];
    }

    const json = (await res.json()) as any;
    const children: any[] = json?.data?.children ?? [];
    if (!Array.isArray(children)) return [];

    const now = Date.now();

    return children
      .map((child, index): SignalEvent | null => {
        const data = child?.data;
        if (!data || typeof data.title !== "string") return null;

        const ups =
          typeof data.ups === "number"
            ? data.ups
            : typeof data.score === "number"
            ? data.score
            : 0;

        const numComments =
          typeof data.num_comments === "number" ? data.num_comments : undefined;

        const createdUtc =
          typeof data.created_utc === "number" ? data.created_utc * 1000 : now;

        const tags: string[] = ["reddit", `subreddit:${subreddit.toLowerCase()}`];

        if (typeof data.link_flair_text === "string" && data.link_flair_text) {
          tags.push(`flair:${data.link_flair_text}`);
        }
        if (data.is_video) tags.push("video");

        return {
          id: `reddit-${subreddit}-${data.id ?? index}`,
          source: "reddit",
          label: data.title,
          score: ups,
          volume: numComments,
          tags,
          timestamp: new Date(createdUtc).toISOString(),
        };
      })
      .filter((s): s is SignalEvent => s !== null);
  } finally {
    cancel();
  }
}

/* -----------------------------
   Stage D: deterministic clustering
-------------------------------- */

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
  "you",
  "your",
  "we",
  "our",
  "their",
  "they",
  "them",
  "i",
  "my",
  "me",
  "reddit",
  "subreddit",
  "r",
]);

function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\[\]\(\)\{\}]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitleForMoment(raw: string): string {
  let t = (raw || "").trim();

  // Strip bracketed prefixes like [Question], [Help], [Discussion], etc.
  t = t.replace(/^\[[^\]]{1,24}\]\s*/g, "");

  // Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();

  // Cap for UI readability
  if (t.length > 84) t = `${t.slice(0, 81)}…`;

  return t;
}

function tokensForLabel(label: string): string[] {
  const raw = normalizeText(label);
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
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function safeNumber(n: any): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
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

type RedditItem = {
  signal: SignalEvent;
  tokens: string[];
  subreddit: string | null;
  weight: number; // simple internal weight for ranking
};

function subredditFromTags(tags: string[] | undefined): string | null {
  const t = (tags ?? []).find((x) => x.startsWith("subreddit:"));
  if (!t) return null;
  return t.split(":")[1] ?? null;
}

function weightForSignal(s: SignalEvent): number {
  // Deterministic: ups (score) + a small comments contribution + recency bonus
  const ups = safeNumber((s as any).score);
  const comments = safeNumber((s as any).volume);
  const mins = minutesSince((s as any).timestamp) ?? 999999;

  const recencyBonus = mins < 60 ? 10 : mins < 240 ? 6 : mins < 1440 ? 3 : 0;
  return ups * 1.0 + comments * 0.25 + recencyBonus;
}

type Cluster = {
  items: RedditItem[];
  tokenCounts: Map<string, number>;
  subreddits: Map<string, number>;
  weightMax: number;
};

function newCluster(): Cluster {
  return {
    items: [],
    tokenCounts: new Map(),
    subreddits: new Map(),
    weightMax: 0,
  };
}

function addToCluster(c: Cluster, item: RedditItem) {
  c.items.push(item);
  for (const t of item.tokens) {
    c.tokenCounts.set(t, (c.tokenCounts.get(t) ?? 0) + 1);
  }
  if (item.subreddit) {
    c.subreddits.set(item.subreddit, (c.subreddits.get(item.subreddit) ?? 0) + 1);
  }
  c.weightMax = Math.max(c.weightMax, item.weight);
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
    if (!it.tokens.length) continue;
    sum += jaccard(it.tokens, cent);
    count += 1;
  }
  if (count === 0) return 0;
  return Math.max(0, Math.min(1, sum / count));
}

function clusterRedditSignals(items: RedditItem[], maxClusters: number): Cluster[] {
  const clusters: Cluster[] = [];

  for (const item of items) {
    let bestIdx = -1;
    let bestSim = 0;

    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const centroid = topTokens(c, 12);
      const sim = jaccard(item.tokens, centroid);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    // Slightly higher than HN to avoid over-merging generic Reddit titles.
    const SHOULD_MERGE = bestIdx >= 0 && bestSim >= 0.26;

    if (SHOULD_MERGE) {
      addToCluster(clusters[bestIdx], item);
    } else {
      const c = newCluster();
      addToCluster(c, item);
      clusters.push(c);
    }
  }

  clusters.sort((a, b) => {
    // Prefer multi-subreddit clusters, then max weight, then size
    const aSubs = a.subreddits.size;
    const bSubs = b.subreddits.size;
    if (bSubs !== aSubs) return bSubs - aSubs;
    if (b.weightMax !== a.weightMax) return b.weightMax - a.weightMax;
    return b.items.length - a.items.length;
  });

  return clusters.slice(0, maxClusters);
}

/**
 * Merge near-duplicate clusters (second pass) to reduce duplicates.
 */
function mergeNearDuplicateClusters(clusters: Cluster[]): Cluster[] {
  const out: Cluster[] = [];

  for (const c of clusters) {
    let merged = false;
    const cCent = topTokens(c, 12);

    for (let i = 0; i < out.length; i++) {
      const e = out[i];
      const eCent = topTokens(e, 12);
      const sim = jaccard(cCent, eCent);
      if (sim >= 0.55) {
        for (const it of c.items) addToCluster(e, it);
        merged = true;
        break;
      }
    }

    if (!merged) out.push(c);
  }

  out.sort((a, b) => {
    const aSubs = a.subreddits.size;
    const bSubs = b.subreddits.size;
    if (bSubs !== aSubs) return bSubs - aSubs;
    if (b.weightMax !== a.weightMax) return b.weightMax - a.weightMax;
    return b.items.length - a.items.length;
  });

  return out;
}

function keyFromCluster(c: Cluster): string {
  const toks = topTokens(c, 6);
  const base = toks.length ? toks.join("_") : "reddit_topic";
  return base.slice(0, 64);
}

function labelFromCluster(c: Cluster): string {
  // Representative: pick best-weight item, then clean title.
  const ranked = [...c.items].sort((a, b) => b.weight - a.weight);
  const title = cleanTitleForMoment(ranked[0]?.signal?.label ?? "");
  if (title) return title;

  // fallback: token headline
  const toks = topTokens(c, 5);
  const head = toks.slice(0, 3).join(" ");
  return head ? `Reddit moment: ${head}` : "Reddit moment";
}

function descriptionFromCluster(c: Cluster): string {
  const subs = [...c.subreddits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => `r/${s}`);

  const examples = c.items
    .slice(0, 2)
    .map((it) => cleanTitleForMoment(it.signal.label))
    .filter(Boolean);

  const cohesion = clusterCohesion(c);
  const bits: string[] = [];

  bits.push(
    "Why now: multiple related Reddit signals clustering suggests an active conversation thread with shared tension."
  );
  bits.push(
    `Signal: Reddit cluster · ${c.items.length} posts` +
      (subs.length ? ` · ${subs.join(", ")}` : "") +
      `.`
  );
  bits.push(`Cohesion: ${cohesion >= 0.6 ? "strong" : cohesion >= 0.4 ? "medium" : "weak"}.`);
  if (examples.length) bits.push(`Examples: ${examples.join(" · ")}.`);

  return bits.join(" ");
}

/**
 * Build TrendSignal[] from one or more subreddits.
 * Stage D: cluster posts into moment-like topics (deterministic, safe).
 */
export async function fetchRedditTrendSignals(
  subreddits: string[],
  limitPerSub: number = 10
): Promise<TrendSignal[]> {
  const allSignals: SignalEvent[] = [];

  for (const sub of subreddits) {
    const signals = await fetchRedditHotSignals(sub, limitPerSub);
    allSignals.push(...signals);
  }

  if (allSignals.length === 0) return [];

  // Normalize into clusterable items
  const items: RedditItem[] = allSignals
    .map((s): RedditItem => {
      const tokens = tokensForLabel(s.label);
      const subreddit = subredditFromTags((s as any).tags);
      const weight = weightForSignal(s);
      return { signal: s, tokens, subreddit, weight };
    })
    // Drop ultra-empty tokenization (usually noise)
    .filter((x) => x.tokens.length >= 2);

  if (items.length === 0) return [];

  // Target: ~6–10 clusters depending on volume
  const maxClusters = Math.max(6, Math.min(10, Math.ceil(items.length / 3)));

  const clustered = clusterRedditSignals(items, maxClusters);
  const merged = mergeNearDuplicateClusters(clustered).slice(0, maxClusters);

  // Convert clusters → TrendSignal[]
  return merged.map((c) => {
    const toks = topTokens(c, 8);
    const subs = [...c.subreddits.keys()].sort().join(",");

    const seed = `${subs}|${toks.join(",")}|${c.items.length}`;
    const id = `reddit-moment:${hashString(seed)}`;

    return {
      id,
      key: normaliseKey(keyFromCluster(c)),
      label: labelFromCluster(c),
      description: descriptionFromCluster(c),
      signals: c.items.map((it) => it.signal),
      category: "Reddit moment",
    };
  });
}

/**
 * Convenience helper: fetch real Reddit topics and interpret into Trend[]
 * using the same engine as the mock.
 */
export async function fetchRedditTrends(subreddits: string[], limitPerSub: number = 10) {
  const trendSignals = await fetchRedditTrendSignals(subreddits, limitPerSub);
  return interpretTrendSignals(trendSignals);
}

/**
 * Normalise a title into a simple key.
 */
function normaliseKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}
