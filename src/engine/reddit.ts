// src/engine/reddit.ts
//
// Stage 2: First real signal adapter (Reddit).
// Fetches hot posts from one or more subreddits, maps them into SignalEvent[],
// then into TrendSignal[], and you can interpret to Trend[] using
// interpretTrendSignals from ./trends.
//
// Deterministic only. No AI. No guessing.

import type { SignalEvent, TrendSignal } from "@/engine/trends";
import { interpretTrendSignals } from "@/engine/trends";

/**
 * Deterministic Market Tagging (NO AI, NO GUESSING)
 * We tag signals with "market:<id>" based on:
 * - subreddit name
 * - title keywords (lowercased substring match)
 *
 * This enables Market Focus filtering on the Trends UI
 * without contaminating qualification/decision logic.
 */
type MarketId =
  | "fragrance"
  | "beauty"
  | "fashion"
  | "fitness"
  | "food"
  | "travel"
  | "tech"
  | "finance"
  | "gaming"
  | "creator"
  | "b2b";

const MARKET_KEYWORDS: Record<MarketId, string[]> = {
  fragrance: [
    "fragrance",
    "perfume",
    "parfum",
    "cologne",
    "scent",
    "eau de",
    "notes",
    "oud",
    "amber",
    "vanilla",
    "musk",
  ],
  beauty: [
    "beauty",
    "skincare",
    "skin care",
    "makeup",
    "cosmetic",
    "foundation",
    "serum",
    "spf",
    "retinol",
    "acne",
    "glow",
  ],
  fashion: [
    "fashion",
    "outfit",
    "style",
    "streetwear",
    "runway",
    "wardrobe",
    "clothing",
    "aesthetic",
  ],
  fitness: [
    "fitness",
    "workout",
    "gym",
    "running",
    "strength",
    "protein",
    "wellness",
    "health",
    "sleep",
    "nutrition",
  ],
  food: [
    "food",
    "drink",
    "recipe",
    "cooking",
    "restaurant",
    "coffee",
    "tea",
    "cocktail",
    "wine",
    "beer",
  ],
  travel: [
    "travel",
    "trip",
    "holiday",
    "vacation",
    "city break",
    "hotel",
    "airbnb",
    "itinerary",
    "tour",
    "flight",
  ],
  tech: ["tech", "ai", "app", "software", "device", "gadget", "startup", "open source", "product"],
  finance: [
    "finance",
    "invest",
    "stocks",
    "crypto",
    "bitcoin",
    "trading",
    "savings",
    "interest rate",
    "interest rates",
    "inflation",
  ],
  gaming: ["gaming", "game", "xbox", "playstation", "nintendo", "steam", "esports", "streaming"],
  creator: [
    "creator",
    "ugc",
    "tiktok",
    "reels",
    "shorts",
    "content",
    "influencer",
    "editing",
    "storytelling",
    "vlog",
  ],
  b2b: [
    "b2b",
    "saas",
    "enterprise",
    "sales",
    "marketing",
    "pipeline",
    "crm",
    "lead",
    "productivity",
    "teams",
  ],
};

function normalize(s: string) {
  return (s || "").toLowerCase().trim();
}

function classifyMarkets(title: string, subreddit: string): MarketId[] {
  const t = normalize(title);
  const sub = normalize(subreddit);

  const hits = new Set<MarketId>();

  // 1) Subreddit-based hints (deterministic)
  if (sub.includes("fragrance") || sub.includes("perfume") || sub.includes("cologne"))
    hits.add("fragrance");
  if (sub.includes("skincare") || sub.includes("makeup") || sub === "beauty") hits.add("beauty");
  if (sub.includes("streetwear") || sub.includes("fashion")) hits.add("fashion");
  if (sub.includes("fitness") || sub.includes("running")) hits.add("fitness");
  if (sub.includes("food") || sub.includes("cooking") || sub.includes("coffee")) hits.add("food");
  if (sub.includes("travel")) hits.add("travel");
  if (sub.includes("technology") || sub.includes("gadgets")) hits.add("tech");
  if (sub.includes("personalfinance") || sub.includes("investing")) hits.add("finance");
  if (sub.includes("gaming") || sub.includes("pcgaming")) hits.add("gaming");
  if (
    sub.includes("tiktok") ||
    sub.includes("instagram") ||
    sub.includes("marketing") ||
    sub.includes("socialmedia")
  ) {
    hits.add("creator");
    hits.add("b2b");
  }
  if (sub.includes("sales") || sub.includes("saas") || sub.includes("entrepreneur"))
    hits.add("b2b");

  // 2) Title keyword hits (deterministic substring match)
  (Object.keys(MARKET_KEYWORDS) as MarketId[]).forEach((market) => {
    const keys = MARKET_KEYWORDS[market];
    if (keys.some((k) => t.includes(normalize(k)))) hits.add(market);
  });

  return Array.from(hits);
}

/**
 * Stage 2.6B — Moment Candidate bucketing (deterministic)
 * This is NOT intelligence. It is pure organisation of already-fetched posts.
 */
type MomentBucketId =
  | "etiquette_friction"
  | "ingredients_accords"
  | "brand_trust_risk"
  | "awards_releases"
  | "collection_economics"
  | "events_community"
  | "workplace_social"
  | "other";

const MOMENT_BUCKETS: Array<{ id: MomentBucketId; label: string; keywords: string[] }> = [
  {
    id: "awards_releases",
    label: "Awards / releases / industry",
    keywords: [
      "award",
      "winners",
      "release",
      "launched",
      "new",
      "2026",
      "2025",
      "fragrantica",
      "ifpra",
      "if ra",
      "ifra",
      "community award",
      "launch",
      "drop",
    ],
  },
  {
    id: "brand_trust_risk",
    label: "Brand trust / dupes / compliance",
    keywords: [
      "warning",
      "scam",
      "fake",
      "counterfeit",
      "dupe",
      "clone",
      "alt",
      "non-compliant",
      "non compliant",
      "ifra",
      "legit",
      "authentic",
      "complaint",
      "over-rated",
      "overrated",
      "underrated",
      "house",
      "brand",
    ],
  },
  {
    id: "etiquette_friction",
    label: "Etiquette / social friction",
    keywords: [
      "overspray",
      "over spray",
      "offend",
      "offended",
      "annoy",
      "headache",
      "nausea",
      "sensitive",
      "projection",
      "sillage",
      "too strong",
      "compliment",
      "etiquette",
    ],
  },
  {
    id: "ingredients_accords",
    label: "Ingredients / accords debate",
    keywords: [
      "iris",
      "ambrox",
      "aldehyde",
      "aldehydes",
      "oud",
      "musk",
      "vanilla",
      "amber",
      "attar",
      "oil",
      "notes",
      "smell like",
      "accord",
    ],
  },
  {
    id: "workplace_social",
    label: "Workplace / social context",
    keywords: ["work", "job", "office", "coworker", "colleague", "interview", "school"],
  },
  {
    id: "collection_economics",
    label: "Collection economics / value",
    keywords: [
      "afford",
      "collection",
      "stash",
      "expensive",
      "price",
      "value",
      "budget",
      "blind buy",
      "blind-buy",
      "sample",
      "discovery set",
    ],
  },
  {
    id: "events_community",
    label: "Events / community moments",
    keywords: ["meetup", "event", "expo", "scentxplore", "discord", "server", "community"],
  },
];

function bucketMomentCandidate(title: string): { id: MomentBucketId; label: string } {
  const t = normalize(title);
  if (!t) return { id: "other", label: "Other" };

  let best: { id: MomentBucketId; label: string; score: number } = {
    id: "other",
    label: "Other",
    score: 0,
  };

  for (const b of MOMENT_BUCKETS) {
    let score = 0;
    for (const k of b.keywords) if (t.includes(normalize(k))) score += 1;
    if (score > best.score) best = { id: b.id, label: b.label, score };
  }

  return { id: best.id, label: best.label };
}

/**
 * Stage 2.6A — Hygiene filter (deterministic)
 */
function isStructuralNoiseTitle(title: string): boolean {
  const t = normalize(title);
  if (!t) return true;

  const genericExact = new Set([
    "any suggestions?",
    "any suggestions",
    "any recommendation?",
    "any recommendations?",
    "does it exist?",
    "does it exist",
    "help",
    "help!",
    "suggestions?",
    "recommendations?",
    "thoughts?",
  ]);
  if (genericExact.has(t)) return true;

  const patterns: RegExp[] = [
    /\bdaily\b.*\b(questions?|discussion|advice|thread)\b/i,
    /\bweekly\b.*\b(questions?|discussion|advice|thread)\b/i,
    /\bmonthly\b.*\b(questions?|discussion|advice|thread)\b/i,
    /\bmegathread\b/i,
    /\bmega thread\b/i,
    /\b(please\s+read|read\s+this|read\s+first|start\s+here)\b/i,
    /\b(rules|rule\s*\d+)\b/i,
    /\b(announcement|announcing|notice|update)\b/i,
    /\b(mod\s+post|moderator\s+post)\b/i,
    /\b(sticky|stickied)\b/i,
    /\bfaq\b/i,
    /\bwelcome\b/i,
    /\bhow\s+to\b.*\b(post|submit)\b/i,
    /\b(post\s+here|post\s+in\s+this)\b/i,
    /\bhelp\s+thread\b/i,
    /\brequest\s+thread\b/i,
    /\bdup(e)?\s+request\b/i,
    /\blegit\s+check\b/i,

    /\b(sotd|scent\s+of\s+the\s+day)\b/i,
    /\bwhat('?s|\s+is)\s+your\s+(sotd|scent\s+of\s+the\s+day)\b/i,

    /\brate\s+my\s+(collection|shelf|tray)\b/i,
    /\bwhat\s+does\s+my\s+collection\s+say\s+about\s+me\b/i,
    /\b(my\s+)?collection\b.*(:|$)/i,
    /\b(my\s+)?tray\b/i,
    /\bempties\b/i,
    /\bpickups?\b/i,
    /\bhaul\b/i,
    /\bshelfie\b/i,
  ];

  return patterns.some((re) => re.test(t));
}

function isLikelyMetaPost(subreddit: string, flairText?: string): boolean {
  const sub = normalize(subreddit);
  const flair = normalize(flairText || "");

  if (sub.includes("colognecheck") || sub.includes("legitcheck")) return true;
  if (flair.includes("announcement")) return true;
  if (flair.includes("mod")) return true;
  if (flair.includes("rules")) return true;

  return false;
}

/**
 * Cluster key canonicalization (deterministic, conservative).
 * This is NOT semantic similarity; it only catches obvious near-dupes.
 */
function canonicalizeTitleForCluster(title: string): string {
  const t = normalize(title);

  // strip quotes
  let s = t.replace(/[“”"'`]/g, "");

  // normalize common "part X" / "pt X"
  s = s.replace(/\b(part|pt)\s*\d+\b/g, "");

  // normalize separators/punct → spaces
  s = s.replace(/[^a-z0-9]+/g, " ");

  // collapse spaces
  s = s.replace(/\s+/g, " ").trim();

  // guardrail length
  if (s.length > 80) s = s.slice(0, 80).trim();

  return s;
}

// ------------------------
// Reddit JSON shape guards
// ------------------------

type RedditListing = {
  data?: {
    children?: unknown[];
  };
};

type RedditChild = {
  data?: unknown;
};

type RedditPost = {
  id?: string;
  title?: string;
  link_flair_text?: string | null;
  is_video?: boolean;
  ups?: number;
  score?: number;
  num_comments?: number;
  created_utc?: number; // seconds
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function asRedditListing(v: unknown): RedditListing | null {
  if (!isRecord(v)) return null;
  return v as RedditListing;
}

function asRedditChild(v: unknown): RedditChild | null {
  if (!isRecord(v)) return null;
  return v as RedditChild;
}

function asRedditPost(v: unknown): RedditPost | null {
  if (!isRecord(v)) return null;
  return v as RedditPost;
}

/**
 * Fetch hot posts from a single subreddit.
 * Uses Reddit's public JSON endpoint (no auth).
 *
 * Rules:
 * - Never throw (return [] on failure)
 * - Avoid hanging requests (timeout)
 * - Apply deterministic hygiene filter to remove noise
 */
export async function fetchRedditHotSignals(
  subreddit: string,
  limit: number = 15
): Promise<SignalEvent[]> {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;

  const controller = new AbortController();
  const timeoutMs = 8000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Appatize/0.1 (trend-ingest)" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(
        `[RedditAdapter] Failed to fetch /r/${subreddit}/hot.json: ${res.status} ${res.statusText}`
      );
      return [];
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch (parseErr) {
      console.error(`[RedditAdapter] JSON parse failed for /r/${subreddit}:`, parseErr);
      return [];
    }

    const listing = asRedditListing(json);
    const childrenUnknown = listing?.data?.children;
    const children: unknown[] = Array.isArray(childrenUnknown) ? childrenUnknown : [];
    if (children.length === 0) return [];

    const now = Date.now();

    return children
      .map((child, index): SignalEvent | null => {
        const c = asRedditChild(child);
        const data = asRedditPost(c?.data);
        if (!data || typeof data.title !== "string") return null;

        const title = data.title;

        const flairText =
          typeof data.link_flair_text === "string" && data.link_flair_text.trim().length > 0
            ? data.link_flair_text
            : undefined;

        // --- HYGIENE FILTER (deterministic) ---
        if (isStructuralNoiseTitle(title)) return null;
        if (isLikelyMetaPost(subreddit, flairText)) return null;

        const ups =
          typeof data.ups === "number" ? data.ups : typeof data.score === "number" ? data.score : 0;

        const numComments = typeof data.num_comments === "number" ? data.num_comments : undefined;

        const createdUtc = typeof data.created_utc === "number" ? data.created_utc * 1000 : now;

        // Base tags (source + subreddit)
        const tags: string[] = ["reddit", `subreddit:${subreddit.toLowerCase()}`];

        if (flairText) tags.push(`flair:${flairText}`);
        if (data.is_video) tags.push("video");

        // Deterministic market tags (zero AI)
        const markets = classifyMarkets(title, subreddit);
        markets.forEach((m) => tags.push(`market:${m}`));

        // Deterministic moment bucket tags
        const bucket = bucketMomentCandidate(title);
        tags.push(`bucket:${bucket.id}`);

        return {
          id: `reddit-${subreddit}-${data.id ?? index}`,
          source: "reddit",
          label: title,
          score: ups,
          volume: numComments,
          tags,
          timestamp: new Date(createdUtc).toISOString(),
        };
      })
      .filter((s): s is SignalEvent => s !== null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[RedditAdapter] Fetch error for /r/${subreddit}:`, msg);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build TrendSignal[] from one or more subreddits.
 * Deterministic clustering:
 * - group signals by (bucket + canonicalizedTitleForCluster)
 * - merge subreddit list into description
 * - category uses bucket label + market suffix
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

  // Cluster map: key -> signals[]
  const clusters = new Map<string, SignalEvent[]>();

  for (const s of allSignals) {
    const title = s.label || "";
    const bucket = bucketMomentCandidate(title);
    const canon = canonicalizeTitleForCluster(title);

    // If canon is empty, fall back to normalized key so it doesn't disappear.
    const safeCanon = canon.length > 0 ? canon : normaliseKey(title);

    const clusterKey = `bucket:${bucket.id}|${safeCanon}`;
    const arr = clusters.get(clusterKey) ?? [];
    arr.push(s);
    clusters.set(clusterKey, arr);
  }

  const trendSignals: TrendSignal[] = [];

  for (const [clusterKey, signals] of clusters.entries()) {
    // Deterministic sort: newest first inside the cluster
    const sorted = [...signals].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

    // Representative is newest (deterministic)
    const representative = sorted[0];
    const title = representative?.label || "Untitled";
    const bucket = bucketMomentCandidate(title);

    // Subreddit suffix (deterministic from tags)
    const subTags = new Set<string>();
    for (const sig of sorted)
      for (const t of sig.tags || []) if (t.startsWith("subreddit:")) subTags.add(t);
    const subList = Array.from(subTags).sort();
    const subredditSuffix = subList.length > 0 ? ` from ${subList.join(", ")}` : "";

    // Market suffix (deterministic, union across cluster)
    const marketTags = new Set<string>();
    for (const sig of sorted)
      for (const t of sig.tags || []) if (t.startsWith("market:")) marketTags.add(t);

    const markets = Array.from(marketTags)
      .map((m) => m.replace("market:", ""))
      .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
      .sort();

    const marketSuffix = markets.length > 0 ? ` · Market: ${markets.slice(0, 3).join(" + ")}` : "";

    trendSignals.push({
      id: `trend-reddit-${bucket.id}-${hashString(clusterKey)}`,
      key: normaliseKey(clusterKey),
      label: title,
      description: `Live Reddit cluster${subredditSuffix}`,
      signals: sorted,
      category: `Moment candidate · ${bucket.label}${marketSuffix}`,
    });
  }

  return trendSignals;
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
  return (label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

/**
 * Tiny deterministic hash to make stable-ish cluster IDs without UUIDs.
 * (Not cryptographic.)
 */
function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
