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

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

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
    const accessToken =
      typeof json?.access_token === "string" ? json.access_token : "";
    const expiresIn =
      typeof json?.expires_in === "number" ? json.expires_in : 0;

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
  const url = `https://oauth.reddit.com/r/${encodeURIComponent(
    subreddit
  )}/hot?limit=${limit}`;

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
          typeof data.created_utc === "number"
            ? data.created_utc * 1000
            : now;

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

  return allSignals.map((signal) => ({
    id: `trend-${signal.id}`,
    key: normaliseKey(signal.label),
    label: signal.label,
    description: `Live Reddit topic from ${signal.tags
      .filter((t) => t.startsWith("subreddit:"))
      .join(", ")}`,
    signals: [signal],
    category: "Reddit topic",
  }));
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
