// @internal/mse/convergence/convergeSignals.ts
//
// Stage 6.4 — Multi-Source Convergence Logic
//
// Goals:
// - Attach source confidence weights
// - Detect cross-source corroboration
// - Promote items → candidate moments based on agreement, NOT volume
//
// Rules:
// - Deterministic, no randomness
// - No “fake” promotion when only one source is present
// - No drift-by-volume: clusters are signature-stable
// - Safe empty states
//
// Guardrail:
// - Normalization may ONLY reduce superficial mismatch (HTML entities, casing,
//   tiny synonym folding). It must NEVER introduce new concepts and must NEVER
//   change minAgreeingSources semantics.

export type ConvergenceSignalItem = {
  id: string;

  // IMPORTANT:
  // "source" is the *source key used for convergence* (hn, reddit, wired, theverge, bbc_business, etc).
  // It must be granular enough to allow corroboration across sources.
  source: string;

  title: string;
  summary?: string;
  url?: string;
  author?: string;
  score?: number;
  createdAtISO?: string;
};

export type ConvergenceConfig = {
  minAgreeingSources: number;
  minCorroborationScore: number;
  similarityThreshold: number;
  maxCandidates?: number;
  sourceWeights?: Record<string, number>;
  defaultSourceWeight?: number;
};

export type ConvergedCandidateMoment = {
  id: string;
  signature: string[];
  corroborationScore: number;
  agreeingSources: string[];
  evidenceCount: number;
  evidence: Array<{
    id: string;
    source: string;
    title: string;
    url?: string;
    createdAtISO?: string;
    weight: number;
    sig: string[];
  }>;
};

type Entry = {
  item: ConvergenceSignalItem;
  sig: string[];
  w: number;
  src: string;
};

type Cluster = {
  id: string;
  sig: string[];
  members: Entry[];
};

/** ✅ MUST be exported because convergeSignals is exported */
export type ConvergeResult = {
  candidates: ConvergedCandidateMoment[];
  debug: {
    totalItems: number;
    clustered: number;
    totalClusters: number;
    promotedClusters: number;
    blockedSingleSourceClusters: number;

    // Helpful for tuning (deterministic)
    avgSigLen: number;
    avgClusterSize: number;
  };
};

/* ----------------------------------------------------- */
/* Normalisation helpers                                 */
/* ----------------------------------------------------- */

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
  "ask",
  "launch",
]);

/**
 * Tiny synonym folding to improve cross-source matching for the SAME real-world thing.
 * Keep this list conservative. It is not "intelligence" — it's normalization.
 *
 * NOTE: keys and values must be lowercase.
 */
const TOKEN_ALIASES: Record<string, string> = {
  // RAM vs memory headlines are extremely common across HN vs outlets
  memory: "ram",
  ram: "ram",

  // small common pairs that frequently block corroboration
  ai: "ai",
  "artificial": "ai", // (tokenize splits "artificial intelligence" into two tokens)
  intelligence: "ai",

  // price spike language
  hike: "spike",
  hikes: "spike",
  surge: "spike",
  surges: "spike",
  exploded: "spike",
  explode: "spike",
  explosion: "spike",
  spiking: "spike",
  spike: "spike",
};

function decodeHtmlEntities(input: string): string {
  // Keep this intentionally small + deterministic (no DOM).
  // This is enough to prevent tokens like "amp" and "x27" polluting signatures.
  return (input || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2F;|&#47;/g, "/")
    .replace(/&#8230;|&hellip;/g, "…");
}

function stripHtmlTags(input: string): string {
  // For RSS summaries which often contain <p> etc.
  return (input || "").replace(/<[^>]*>/g, " ");
}

function normText(s: string): string {
  const cleaned = stripHtmlTags(decodeHtmlEntities(s || ""));
  return cleaned
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeToken(t: string): string {
  const raw = (t || "").toLowerCase().trim();
  if (!raw) return "";

  // ultra-light singularization: "prices" -> "price" (only for simple plural)
  const singular =
    raw.length > 4 && raw.endsWith("s") && !raw.endsWith("ss")
      ? raw.slice(0, -1)
      : raw;

  const aliased = TOKEN_ALIASES[singular] || singular;
  return aliased;
}

function tokenize(text: string): string[] {
  return normText(text)
    .split(" ")
    .map(canonicalizeToken)
    .filter((t) => t.length >= 3 && t.length <= 24 && !STOPWORDS.has(t));
}

function urlTokens(url?: string): string[] {
  if (!url) return [];
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const hostParts = host.split(".").filter(Boolean);

    // ignore ultra-common host noise
    const hostFiltered = hostParts.filter(
      (p) => p && p !== "com" && p !== "co" && p !== "uk" && p !== "www"
    );

    const pathParts = u.pathname
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 6);

    const raw = `${hostFiltered.join(" ")} ${pathParts.join(" ")}`;
    return tokenize(raw);
  } catch {
    return [];
  }
}

function signatureKeywords(it: ConvergenceSignalItem, max = 10): string[] {
  const title = String(it.title || "").trim();
  const summary = String(it.summary || "").trim();

  // If summary missing, lean harder on title + URL tokens.
  // (Title duplicated is intentional: it increases token frequency for centroiding.)
  const rawText = summary ? `${title} ${summary}` : `${title} ${title}`;

  const toks = tokenize(rawText);
  const uToks = urlTokens(it.url);

  const seen = new Set<string>();
  const out: string[] = [];

  // Prefer content tokens, then URL tokens.
  for (const t of toks) {
    if (!t) continue;
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
    if (out.length >= max) return out;
  }

  for (const t of uToks) {
    if (!t) continue;
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
    if (out.length >= max) break;
  }

  return out;
}

function normalizeSourceKey(source: string): string {
  const s = String(source || "").toLowerCase().trim();
  if (s.includes("hackernews") || s === "hn") return "hn";
  return s || "unknown";
}

/* ----------------------------------------------------- */
/* Similarity                                            */
/* ----------------------------------------------------- */

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;

  const A = new Set(a);
  const B = new Set(b);

  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;

  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

function stableClusterId(sig: string[]): string {
  return `c_${sig.slice(0, 8).join("_") || "empty"}`;
}

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
}

/**
 * Determines whether a source key should fall back to the "rss" weight group.
 * This lets RSS outlets (wired, theverge, bbc_business, etc) share a single weight
 * without needing to enumerate every outlet in config.
 *
 * Deterministic + conservative:
 * - Only activates if cfg.sourceWeights.rss exists.
 * - Excludes known non-RSS sources (hn, reddit).
 */
function isRssOutletKey(src: string): boolean {
  const s = String(src || "").toLowerCase().trim();
  if (!s) return false;
  if (s === "hn" || s === "reddit") return false;
  // Treat everything else as "rss outlet key" in this early stage
  // because rss route emits outlet keys (wired, theverge, guardian_business, etc).
  return true;
}

function getSourceWeight(src: string, cfg: ConvergenceConfig): number {
  const def =
    typeof cfg.defaultSourceWeight === "number"
      ? clamp01(cfg.defaultSourceWeight)
      : 0.6;

  // Exact match wins.
  const direct = cfg.sourceWeights?.[src];
  if (typeof direct === "number") return clamp01(direct);

  // Compatibility: if config provides an "rss" group weight, apply it to RSS outlets.
  const rssGroup = cfg.sourceWeights?.["rss"];
  if (typeof rssGroup === "number" && isRssOutletKey(src)) return clamp01(rssGroup);

  return def;
}

function recomputeClusterSignature(members: Entry[], max = 10): string[] {
  // Deterministic centroid signature:
  // - Count token frequency across all members
  // - Sort by freq desc, then alpha asc
  // - Take top N
  const counts = new Map<string, number>();

  for (const m of members) {
    for (const t of m.sig) {
      if (!t) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    // tie-breaker: stable alpha
    return a[0].localeCompare(b[0]);
  });

  return sorted.slice(0, max).map(([t]) => t);
}

/* ----------------------------------------------------- */
/* Core convergence                                      */
/* ----------------------------------------------------- */

export function convergeSignals(
  items: ConvergenceSignalItem[],
  cfg: ConvergenceConfig
): ConvergeResult {
  const list = Array.isArray(items) ? items : [];
  const maxCandidates =
    typeof cfg.maxCandidates === "number" ? cfg.maxCandidates : 30;

  const entries: Entry[] = list
    .map((it) => {
      const src = normalizeSourceKey(it.source);
      return {
        item: it,
        sig: signatureKeywords(it),
        w: getSourceWeight(src, cfg),
        src,
      };
    })
    .filter((e) => e.sig.length > 0);

  const clusters: Cluster[] = [];

  for (const entry of entries) {
    let bestIdx = -1;
    let bestSim = -1;

    for (let i = 0; i < clusters.length; i++) {
      const sim = jaccard(entry.sig, clusters[i].sig);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestSim >= cfg.similarityThreshold) {
      clusters[bestIdx].members.push(entry);

      // ✅ Key fix: update cluster signature centroid as we add evidence
      // This prevents “first headline wins” behaviour and improves cross-source matching.
      clusters[bestIdx].sig = recomputeClusterSignature(clusters[bestIdx].members);
      clusters[bestIdx].id = stableClusterId(clusters[bestIdx].sig);
    } else {
      clusters.push({
        id: stableClusterId(entry.sig),
        sig: entry.sig,
        members: [entry],
      });
    }
  }

  const candidates: ConvergedCandidateMoment[] = [];
  let promotedClusters = 0;
  let blockedSingleSourceClusters = 0;

  for (const c of clusters) {
    const sources = Array.from(new Set(c.members.map((m) => m.src)));

    if (sources.length < cfg.minAgreeingSources) {
      blockedSingleSourceClusters += 1;
      continue;
    }

    let wSum = 0;
    let scoreSum = 0;

    for (const m of c.members) {
      const sim = jaccard(m.sig, c.sig);
      wSum += m.w;
      scoreSum += m.w * sim;
    }

    const corroborationScore = wSum > 0 ? clamp01(scoreSum / wSum) : 0;
    if (corroborationScore < cfg.minCorroborationScore) continue;

    promotedClusters += 1;

    const evidence = c.members.map((m) => ({
      id: String(m.item.id),
      source: m.src,
      title: String(m.item.title || "").trim(),
      url: typeof m.item.url === "string" ? m.item.url : undefined,
      createdAtISO: m.item.createdAtISO,
      weight: m.w,
      sig: m.sig,
    }));

    candidates.push({
      id: c.id,
      signature: c.sig,
      corroborationScore,
      agreeingSources: sources,
      evidenceCount: evidence.length,
      evidence,
    });
  }

  candidates.sort((a, b) =>
    b.corroborationScore !== a.corroborationScore
      ? b.corroborationScore - a.corroborationScore
      : b.agreeingSources.length - a.agreeingSources.length
  );

  // Debug extras (deterministic)
  const avgSigLen =
    entries.length > 0
      ? entries.reduce((acc, e) => acc + e.sig.length, 0) / entries.length
      : 0;

  const avgClusterSize =
    clusters.length > 0
      ? clusters.reduce((acc, c) => acc + c.members.length, 0) / clusters.length
      : 0;

  return {
    candidates: candidates.slice(0, maxCandidates),
    debug: {
      totalItems: list.length,
      clustered: entries.length,
      totalClusters: clusters.length,
      promotedClusters,
      blockedSingleSourceClusters,
      avgSigLen: Number.isFinite(avgSigLen) ? Number(avgSigLen.toFixed(2)) : 0,
      avgClusterSize: Number.isFinite(avgClusterSize)
        ? Number(avgClusterSize.toFixed(2))
        : 0,
    },
  };
}
