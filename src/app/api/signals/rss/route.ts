// src/app/api/signals/rss/route.ts
//
// Stage D — RSS Signal Source
//
// Rules:
// - Never 500
// - Safe empty states
// - Deterministic IDs (no Math.random())
// - Minimal parsing (RSS + Atom) without extra deps
//
// Notes:
// - This is a pragmatic “2nd source” to enable Stage 6.4 corroboration
// - You can tune/replace feeds later without touching convergence logic

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SignalItem = {
  id: string;
  source: string; // IMPORTANT: this must be the outlet key (wired, guardian_business, etc)
  title: string;
  summary?: string;
  url?: string;
  author?: string;
  score?: number;
  createdAtISO?: string;
};

type RssEnvelope = {
  status: "ok";
  source: "rss";
  items: SignalItem[];
  message?: string;
  debug?: {
    feedsAttempted: number;
    feedsOk: number;
    feedsFailed: number;
  };
};

type FeedDef = {
  key: string; // stable internal key for deterministic IDs
  url: string;
  maxItems?: number;
};

// ----------------------------
// Feed list (tunable later)
// ----------------------------

// Keep this modest; the goal is corroboration, not volume.
const FEEDS: FeedDef[] = [
  { key: "bbc_business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", maxItems: 10 },
  { key: "theverge", url: "https://www.theverge.com/rss/index.xml", maxItems: 10 }, // Atom
  { key: "arstechnica", url: "https://feeds.arstechnica.com/arstechnica/index", maxItems: 10 },
  { key: "wired", url: "https://www.wired.com/feed/rss", maxItems: 10 },
  { key: "guardian_business", url: "https://www.theguardian.com/uk/business/rss", maxItems: 10 },
];

// ----------------------------
// Helpers
// ----------------------------

function stripHtml(s: string): string {
  return (s || "")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gi, "$1")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(xml: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = xml.match(p);
    if (m && typeof m[1] === "string" && m[1].trim()) return m[1].trim();
  }
  return "";
}

function parseDateToIso(raw: string): string | undefined {
  if (!raw) return undefined;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return undefined;
  return new Date(t).toISOString();
}

function stableId(sourceKey: string, link: string, title: string, createdAtISO?: string): string {
  // Deterministic ID: prefer link; else title+date
  const l = (link || "").trim();
  if (l) return `rss:${sourceKey}:${l}`;

  const base = (title || "untitled").toLowerCase().slice(0, 140);
  const d = createdAtISO ? createdAtISO.slice(0, 10) : "nodate";
  return `rss:${sourceKey}:title:${base}:${d}`;
}

async function fetchTextWithTimeout(url: string, ms = 7000): Promise<string | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Appatize/1.0 (+signal-router)",
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });

    if (!res.ok) return null;
    const txt = await res.text();
    return typeof txt === "string" && txt.trim() ? txt : null;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

// ----------------------------
// Parsing (RSS + Atom)
// ----------------------------

function parseRssItems(feedKey: string, xml: string, maxItems: number): SignalItem[] {
  const items: SignalItem[] = [];

  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks.slice(0, maxItems)) {
    const title = stripHtml(firstMatch(block, [/<title[^>]*>([\s\S]*?)<\/title>/i]));
    if (!title) continue;

    // Prefer <link>, fall back to <guid> if it looks like a URL
    const link = firstMatch(block, [
      /<link[^>]*>([\s\S]*?)<\/link>/i,
      /<guid[^>]*>([\s\S]*?)<\/guid>/i,
    ]).trim();

    const descRaw = firstMatch(block, [
      /<description[^>]*>([\s\S]*?)<\/description>/i,
      /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i,
      /<summary[^>]*>([\s\S]*?)<\/summary>/i,
    ]);

    const author = stripHtml(
      firstMatch(block, [
        /<author[^>]*>([\s\S]*?)<\/author>/i,
        /<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i,
      ])
    );

    const pubDate = firstMatch(block, [
      /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i,
      /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i,
    ]);

    const createdAtISO = parseDateToIso(stripHtml(pubDate));
    const summary = stripHtml(descRaw).slice(0, 320);

    items.push({
      id: stableId(feedKey, stripHtml(link), title, createdAtISO),
      // IMPORTANT: outlet key for convergence
      source: feedKey,
      title,
      summary: summary || undefined,
      url: stripHtml(link) || undefined,
      author: author || undefined,
      createdAtISO,
    });
  }

  return items;
}

function parseAtomItems(feedKey: string, xml: string, maxItems: number): SignalItem[] {
  const items: SignalItem[] = [];

  const entryBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const block of entryBlocks.slice(0, maxItems)) {
    const title = stripHtml(firstMatch(block, [/<title[^>]*>([\s\S]*?)<\/title>/i]));
    if (!title) continue;

    const linkHref = firstMatch(block, [
      /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i,
      /<link[^>]*>([\s\S]*?)<\/link>/i,
    ]);

    const summaryRaw = firstMatch(block, [
      /<summary[^>]*>([\s\S]*?)<\/summary>/i,
      /<content[^>]*>([\s\S]*?)<\/content>/i,
    ]);

    const author = stripHtml(
      firstMatch(block, [
        /<author[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i,
        /<name[^>]*>([\s\S]*?)<\/name>/i,
      ])
    );

    const updated = firstMatch(block, [
      /<updated[^>]*>([\s\S]*?)<\/updated>/i,
      /<published[^>]*>([\s\S]*?)<\/published>/i,
    ]);

    const createdAtISO = parseDateToIso(stripHtml(updated));
    const summary = stripHtml(summaryRaw).slice(0, 320);

    items.push({
      id: stableId(feedKey, stripHtml(linkHref), title, createdAtISO),
      // IMPORTANT: outlet key for convergence
      source: feedKey,
      title,
      summary: summary || undefined,
      url: stripHtml(linkHref) || undefined,
      author: author || undefined,
      createdAtISO,
    });
  }

  return items;
}

function parseFeed(feedKey: string, xml: string, maxItems: number): SignalItem[] {
  const lower = xml.toLowerCase();

  const isAtom = lower.includes("<feed") && lower.includes("<entry");
  if (isAtom) return parseAtomItems(feedKey, xml, maxItems);

  const isRss = lower.includes("<rss") || lower.includes("<channel") || lower.includes("<item");
  if (isRss) return parseRssItems(feedKey, xml, maxItems);

  return [];
}

// ----------------------------
// Route
// ----------------------------

export async function GET() {
  try {
    const all: SignalItem[] = [];
    let ok = 0;
    let failed = 0;

    for (const feed of FEEDS) {
      const maxItems = typeof feed.maxItems === "number" ? feed.maxItems : 10;

      const xml = await fetchTextWithTimeout(feed.url, 8000);
      if (!xml) {
        failed += 1;
        continue;
      }

      const parsed = parseFeed(feed.key, xml, maxItems);
      if (parsed.length > 0) ok += 1;
      else failed += 1;

      all.push(...parsed);
    }

    const seen = new Set<string>();
    const deduped: SignalItem[] = [];
    for (const it of all) {
      if (!it?.id || seen.has(it.id)) continue;
      seen.add(it.id);
      deduped.push(it);
    }

    deduped.sort((a, b) => {
      const ta = a.createdAtISO ? Date.parse(a.createdAtISO) : 0;
      const tb = b.createdAtISO ? Date.parse(b.createdAtISO) : 0;
      return tb - ta;
    });

    const payload: RssEnvelope = {
      status: "ok",
      source: "rss",
      items: deduped.slice(0, 60),
      message: deduped.length === 0 ? "RSS source returned no usable items." : undefined,
      debug: {
        feedsAttempted: FEEDS.length,
        feedsOk: ok,
        feedsFailed: failed,
      },
    };

    return NextResponse.json(payload, { status: 200 });
  } catch {
    const payload: RssEnvelope = {
      status: "ok",
      source: "rss",
      items: [],
      message: "RSS source unavailable; returning safe empty state.",
      debug: {
        feedsAttempted: FEEDS.length,
        feedsOk: 0,
        feedsFailed: FEEDS.length,
      },
    };

    return NextResponse.json(payload, { status: 200 });
  }
}
