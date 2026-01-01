// src/engine/reddit.ts
//
// Stage 2: First real signal adapter (Reddit).
// Fetches hot posts from one or more subreddits, maps them into SignalEvent[],
// then into TrendSignal[], and you can interpret to Trend[] using
// interpretTrendSignals from ./trends.

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
  tech: [
    "tech",
    "ai",
    "app",
    "software",
    "device",
    "gadget",
    "startup",
    "open source",
    "product",
  ],
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
  gaming: [
    "gaming",
    "game",
    "xbox",
    "playstation",
    "nintendo",
    "steam",
    "esports",
    "streaming",
  ],
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
  if (
    sub.includes("fragrance") ||
    sub.includes("perfume") ||
    sub.includes("cologne")
  ) {
    hits.add("fragrance");
  }
  if (sub.includes("skincare") || sub.includes("makeup") || sub === "beauty") {
    hits.add("beauty");
  }
  if (sub.includes("streetwear") || sub.includes("fashion")) {
    hits.add("fashion");
  }
  if (sub.includes("fitness") || sub.includes("running")) {
    hits.add("fitness");
  }
  if (sub.includes("food") || sub.includes("cooking") || sub.includes("coffee")) {
    hits.add("food");
  }
  if (sub.includes("travel")) {
    hits.add("travel");
  }
  if (sub.includes("technology") || sub.includes("gadgets")) {
    hits.add("tech");
  }
  if (sub.includes("personalfinance") || sub.includes("investing")) {
    hits.add("finance");
  }
  if (sub.includes("gaming") || sub.includes("pcgaming")) {
    hits.add("gaming");
  }
  if (
    sub.includes("tiktok") ||
    sub.includes("instagram") ||
    sub.includes("marketing") ||
    sub.includes("socialmedia")
  ) {
    hits.add("creator");
    hits.add("b2b");
  }
  if (sub.includes("sales") || sub.includes("saas") || sub.includes("entrepreneur")) {
    hits.add("b2b");
  }

  // 2) Title keyword hits (deterministic substring match)
  (Object.keys(MARKET_KEYWORDS) as MarketId[]).forEach((market) => {
    const keys = MARKET_KEYWORDS[market];
    if (keys.some((k) => t.includes(normalize(k)))) {
      hits.add(market);
    }
  });

  return Array.from(hits);
}

/**
 * Stage 2.6B — Moment Candidate bucketing (deterministic)
 * This is NOT intelligence. It is pure organisation of already-fetched posts.
 * Goal: make "brands meet the moment" readable (less community mechanics, more signal themes).
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

const MOMENT_BUCKETS: Array<{
  id: MomentBucketId;
  label: string;
  // Keywords are deterministic substring checks against a normalized title
  keywords: string[];
}> = [
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
      "ifram",
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

  // Score buckets by keyword hits; highest wins. Deterministic.
  let best: { id: MomentBucketId; label: string; score: number } = {
    id: "other",
    label: "Other",
    score: 0,
  };

  for (const b of MOMENT_BUCKETS) {
    let score = 0;
    for (const k of b.keywords) {
      if (t.includes(normalize(k))) score += 1;
    }
    if (score > best.score) {
      best = { id: b.id, label: b.label, score };
    }
  }

  return { id: best.id, label: best.label };
}

/**
 * Stage 2.6A — Hygiene filter (deterministic)
 * Removes noise that is not a "brands meet the moment" signal:
 * - daily/weekly/monthly/megathreads
 * - rules/read first/announcements
 * - SOTD / routine community mechanics
 * - ultra-low-signal generic titles ("Any suggestions?")
 * - collection/tray/pickups/empties posts (optional but enabled here for strategy-grade feed)
 *
 * This is NOT intelligence. It's input hygiene.
 */
function isStructuralNoiseTitle(title: string): boolean {
  const t = normalize(title);

  // Fast exits for empty/invalid
  if (!t) return true;

  // ultra-low-signal / generic titles that add no moment meaning
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

  // Common structural + routine community patterns
  const patterns: RegExp[] = [
    // structural threads
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

    // fragrance-specific routine mechanics
    /\b(sotd|scent\s+of\s+the\s+day)\b/i,
    /\bwhat('?s|\s+is)\s+your\s+(sotd|scent\s+of\s+the\s+day)\b/i,

    // collection mechanics (strategy-grade filter)
    /\brate\s+my\s+(collection|shelf|tray)\b/i,
    /\bwhat\s+does\s+my\s+collection\s+say\s+about\s+me\b/i,
    /\b(my\s+)?collection\b.*(:|$)/i, // "My collection :D"
    /\b(my\s+)?tray\b/i, // "January Tray"
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

  // Subreddit names that are inherently meta/check subs
  if (sub.includes("colognecheck") || sub.includes("legitcheck")) return true;

  // Flairs that strongly imply admin/meta
  if (flair.includes("announcement")) return true;
  if (flair.includes("mod")) return true;
  if (flair.includes("rules")) return true;

  return false;
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

  // Simple timeout guard (keeps route responsive)
  const controller = new AbortController();
  const timeoutMs = 8000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Appatize/0.1 (trend-ingest)",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(
        `[RedditAdapter] Failed to fetch /r/${subreddit}/hot.json: ${res.status} ${res.statusText}`
      );
      return [];
    }

    let json: any;
    try {
      json = await res.json();
    } catch (parseErr) {
      console.error(`[RedditAdapter] JSON parse failed for /r/${subreddit}:`, parseErr);
      return [];
    }

    const children: any[] = json?.data?.children ?? [];
    if (!Array.isArray(children)) return [];

    const now = Date.now();

    return children
      .map((child, index): SignalEvent | null => {
        const data = child?.data;
        if (!data || typeof data.title !== "string") return null;

        const title = data.title;

        const flairText =
          data.link_flair_text && typeof data.link_flair_text === "string"
            ? data.link_flair_text
            : undefined;

        // --- HYGIENE FILTER (deterministic) ---
        if (isStructuralNoiseTitle(title)) return null;
        if (isLikelyMetaPost(subreddit, flairText)) return null;

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

        // Base tags (source + subreddit)
        const tags: string[] = ["reddit", `subreddit:${subreddit.toLowerCase()}`];

        // Flair/video tags
        if (flairText) {
          tags.push(`flair:${flairText}`);
        }
        if (data.is_video) {
          tags.push("video");
        }

        // Deterministic market tags (zero AI)
        const markets = classifyMarkets(title, subreddit);
        markets.forEach((m) => tags.push(`market:${m}`));

        // Deterministic moment bucket tags (2.6B)
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
 * Stage 2.6B: add deterministic bucketing into category for UI readability.
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

  const trendSignals: TrendSignal[] = allSignals.map((signal) => {
    const title = signal.label || "";
    const bucket = bucketMomentCandidate(title);

    // Pull market tags (if present) for a clean suffix label
    const marketTags = (signal.tags || []).filter((t) => t.startsWith("market:"));
    const marketSuffix =
      marketTags.length > 0
        ? ` · Market: ${marketTags
            .map((m) => m.replace("market:", ""))
            .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
            .join(" + ")}`
        : "";

    return {
      id: `trend-${signal.id}`,
      key: normaliseKey(signal.label),
      label: signal.label,
      description: `Live Reddit topic from ${signal.tags
        .filter((t) => t.startsWith("subreddit:"))
        .join(", ")}`,
      signals: [signal],

      // 2.6B: expose bucket in category so existing UI can show it immediately
      category: `Moment candidate · ${bucket.label}${marketSuffix}`,
    };
  });

  return trendSignals;
}

/**
 * Convenience helper: fetch real Reddit topics and interpret into Trend[]
 * using the same engine as the mock.
 */
export async function fetchRedditTrends(
  subreddits: string[],
  limitPerSub: number = 10
) {
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
