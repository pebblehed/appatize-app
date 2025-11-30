// src/engine/reddit.ts
//
// Stage 2: First real signal adapter (Reddit).
// Fetches hot posts from one or more subreddits, maps them into SignalEvent[],
// then into TrendSignal[], and you can interpret to Trend[] using
// interpretTrendSignals from ./trends.

import type { SignalEvent, TrendSignal } from "@/engine/trends";
import { interpretTrendSignals } from "@/engine/trends";

/**
 * Fetch hot posts from a single subreddit.
 * Uses Reddit's public JSON endpoint (no auth).
 */
export async function fetchRedditHotSignals(
  subreddit: string,
  limit: number = 15
): Promise<SignalEvent[]> {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Appatize/0.1 (trend-ingest)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(
      `[RedditAdapter] Failed to fetch /r/${subreddit}/hot.json: ${res.status} ${res.statusText}`
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
        typeof data.created_utc === "number"
          ? data.created_utc * 1000
          : now;

      const tags: string[] = [
        "reddit",
        `subreddit:${subreddit.toLowerCase()}`,
      ];

      if (data.link_flair_text && typeof data.link_flair_text === "string") {
        tags.push(`flair:${data.link_flair_text}`);
      }
      if (data.is_video) {
        tags.push("video");
      }

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
}

/**
 * Build TrendSignal[] from one or more subreddits.
 * For now, each post -> its own TrendSignal.
 * Later we can cluster them more intelligently.
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

  const trendSignals: TrendSignal[] = allSignals.map((signal) => ({
    id: `trend-${signal.id}`,
    key: normaliseKey(signal.label),
    label: signal.label,
    description: `Live Reddit topic from ${signal.tags
      .filter((t) => t.startsWith("subreddit:"))
      .join(", ")}`,
    signals: [signal],
    category: "Reddit topic",
  }));

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
