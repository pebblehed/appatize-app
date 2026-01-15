// internal/contracts/MSE_OUTPUT_SCHEMA.ts
//
// Stage D — MSE Output Schema (Moment Signal Evaluation)
//
// Purpose:
// - Define the *truth-layer* output of MSE: what is happening + why it matters,
//   grounded in evidence, with inspectable scoring + qualification.
// - No creative persuasion. No “angles”. No stylistic copy.
// - This schema is the stable contract between signal ingestion and intelligence
//   shaping (CIE) + UI surfacing.
//
// Rules:
// - Do NOT use `any`.
// - Prefer narrow unions for enums.
// - Keep fields explicit and explainable.
// - Always include evidence references (even if empty) and qualification.
// - “Never fake intelligence”: if uncertain/unavailable, reflect that in fields.
//
// Notes:
// - This file defines Typescript types only (no runtime validators) to avoid
//   inventing dependencies. Runtime validation can be added later where agreed.

export type ISODateTime = string; // ISO 8601 (e.g., 2026-01-13T06:12:00Z)
export type URLString = string;

export type MSEPack =
  | "fragrance"
  | "beauty"
  | "fashion"
  | "fitness"
  | "food"
  | "tech"
  | "gaming"
  | "sports"
  | "finance"
  | "politics"
  | "news"
  | "culture"
  | "generic";

export type SignalSource =
  | "reddit"
  | "hn"
  | "rss"
  | "youtube"
  | "tiktok"
  | "instagram"
  | "x"
  | "web"
  | "manual"
  | "unknown";

export type TrendStatus = "Emerging" | "Peaking" | "Stable" | "Unclear";

export type AvailabilityStatus = "ok" | "partial" | "unavailable" | "rate_limited" | "error";

export type ConfidenceLevel = "low" | "medium" | "high";

export type EvidenceType =
  | "post"
  | "comment"
  | "thread"
  | "article"
  | "video"
  | "image"
  | "link"
  | "metadata"
  | "unknown";

export type DecisionOutcome = "surface" | "hold" | "suppress" | "insufficient_evidence";

export type DecisionReasonCode =
  // Quality / strength
  | "high_momentum"
  | "broad_attention"
  | "novelty_spike"
  | "persistent_signal"
  // Risk / safety
  | "low_confidence"
  | "thin_evidence"
  | "duplicative"
  | "policy_sensitive"
  | "low_relevance"
  // Ops
  | "source_unavailable"
  | "rate_limited"
  | "parser_degraded"
  | "unknown";

export interface SourceRef {
  source: SignalSource;
  // Identifier at source: e.g., Reddit post id, HN item id, RSS guid
  externalId?: string;
  // Canonical URL to view the item
  url?: URLString;
  // Optional author / channel handle (not required)
  author?: string;
  // Optional community / domain (subreddit, site, channel)
  context?: string;
}

export interface EvidenceItem {
  id: string; // stable within a response; can be a hash
  type: EvidenceType;
  sourceRef: SourceRef;

  // Minimal content primitives (truth-only; avoid long text blobs)
  title?: string;
  excerpt?: string; // short snippet, not full body
  publishedAt?: ISODateTime;
  capturedAt: ISODateTime; // when we ingested/observed it

  // Lightweight engagement signals when available
  metrics?: {
    upvotes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };

  // Normalized tags derived deterministically (no “creative” labels)
  tags?: string[];

  // If the evidence is a link-out, record the destination domain
  outboundDomain?: string;
}

export interface EvidenceSummary {
  // Deterministic counts to support UI + downstream reasoning
  totalItems: number;
  bySource: Record<SignalSource, number>;
  byType: Record<EvidenceType, number>;

  // The most recent timestamp found in evidence (if any)
  latestPublishedAt?: ISODateTime;
  // The oldest timestamp found in evidence (if any)
  earliestPublishedAt?: ISODateTime;
}

export interface Qualification {
  // The system’s best faith confidence level, derived from evidence + scoring
  confidence: ConfidenceLevel;

  // If confidence is not high, we must say why (truth-only)
  limitations: string[];

  // Operational availability of upstream signals for this moment
  availability: {
    status: AvailabilityStatus;
    notes?: string[];
  };

  // Whether this moment is safe to surface without extra handling
  // (This is not “policy enforcement”, but a truthy classification flag.)
  sensitivity?: {
    isSensitive: boolean;
    // Keep coarse — do NOT overfit categories early
    category?:
      | "health"
      | "politics"
      | "finance"
      | "adult"
      | "violence"
      | "hate"
      | "self_harm"
      | "other";
    rationale?: string;
  };
}

export interface Scores {
  // All scores are 0..1 (inclusive). Keep deterministic.
  // If not computable, omit and reflect limitation in Qualification.
  momentum?: number; // velocity / engagement acceleration proxy
  breadth?: number; // diversity of sources/contexts
  novelty?: number; // departure from baseline / “newness” proxy
  persistence?: number; // staying power across time window
  relevance?: number; // fit to pack/topic (truthy, not creative)
  overall?: number; // aggregate (document formula in engine, not here)
}

export interface Decision {
  outcome: DecisionOutcome;

  // Explainable, enumerable reasons (codes) with optional short rationale text
  reasons: Array<{
    code: DecisionReasonCode;
    note?: string;
  }>;

  // Optional “kill switch” indicator to prevent accidental surfacing
  // when the system is degraded or evidence is thin.
  stopRuleTriggered?: boolean;
}

export interface MomentIdentity {
  id: string; // stable ID for the moment (e.g., hash of canonical name + window)
  pack: MSEPack;

  // Canonical moment name: what the UI and Scripts page should use
  name: string;

  // Short, truth-only description (1–2 lines). No persuasion.
  description: string;

  // Optional category label for UI grouping (truthy, not creative)
  category?: string;
}

export interface MomentTimeWindow {
  // Time window the moment was evaluated over
  windowStart: ISODateTime;
  windowEnd: ISODateTime;

  // Deterministic recency label (optional; derived from now - latestPublishedAt)
  recencyLabel?: string; // e.g., "last 6h", "last 24h"
}

export interface MomentDerivedLabels {
  // UI-friendly labels, derived deterministically from Scores/Qualification
  status: TrendStatus;

  // Short “format” and “momentum” labels the UI can show.
  // These should remain deterministic and explainable.
  formatLabel: string; // e.g., "Conversation spike", "Cross-thread chatter"
  momentumLabel: string; // e.g., "Rising fast", "Holding", "Unclear"
}

export interface MSEOutput {
  // Contract version for forward compatibility
  schema: {
    name: "MSE_OUTPUT_SCHEMA";
    version: "D.1";
  };

  generatedAt: ISODateTime;

  identity: MomentIdentity;
  timeWindow: MomentTimeWindow;

  labels: MomentDerivedLabels;

  // Evidence must always be present (can be empty array, with limitations)
  evidence: {
    items: EvidenceItem[];
    summary: EvidenceSummary;
  };

  qualification: Qualification;
  scores: Scores;
  decision: Decision;

  // Optional debug/tracing info (safe to omit in UI)
  debug?: {
    // Engine build/tag, not a secret
    build?: string;
    // Deterministic notes (no model prompt dumps)
    notes?: string[];
  };
}

/**
 * Helper: create an empty EvidenceSummary deterministically.
 * (No runtime dependency; safe for routes to use.)
 */
export function emptyEvidenceSummary(): EvidenceSummary {
  return {
    totalItems: 0,
    bySource: {
      reddit: 0,
      hn: 0,
      rss: 0,
      youtube: 0,
      tiktok: 0,
      instagram: 0,
      x: 0,
      web: 0,
      manual: 0,
      unknown: 0,
    },
    byType: {
      post: 0,
      comment: 0,
      thread: 0,
      article: 0,
      video: 0,
      image: 0,
      link: 0,
      metadata: 0,
      unknown: 0,
    },
  };
}
