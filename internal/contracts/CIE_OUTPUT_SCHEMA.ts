// internal/contracts/CIE_OUTPUT_SCHEMA.ts
//
// Stage D — CIE Output Schema (Creative Intelligence Engine)
//
// Purpose:
// - Define the *creative layer* output: usable angles + briefs + script primitives,
//   while staying grounded in MSE truth and fully traceable to evidence.
// - Creativity is allowed; hallucination is not.
// - Every creative claim must be attributable to MSE evidence primitives or
//   explicitly marked as a suggestion/hypothesis.
//
// Rules:
// - Do NOT use `any`.
// - Prefer narrow unions for enums.
// - CIE output MUST carry (or reference) the MSE input identity to preserve provenance.
// - Support multi-angle generation (3–5+) as a core feature.
// - Include constraints and safety notes explicitly.
//
// Note:
// - Typescript types only (no runtime validators). Runtime validation can be added later.

import type {
  MSEOutput,
  ISODateTime,
  URLString,
  ConfidenceLevel,
  SignalSource,

  //EvidenceItem,
  DecisionOutcome,
} from "./MSE_OUTPUT_SCHEMA";

export type Platform =
  | "tiktok"
  | "instagram_reels"
  | "youtube_shorts"
  | "youtube"
  | "x"
  | "linkedin"
  | "reddit"
  | "blog"
  | "podcast"
  | "email"
  | "website"
  | "generic";

export type CreativeTone =
  | "calm"
  | "playful"
  | "bold"
  | "premium"
  | "witty"
  | "empathetic"
  | "urgent"
  | "minimal"
  | "editorial"
  | "educational"
  | "trustworthy"
  | "unknown";

export type EnergyLevel = "low" | "medium" | "high" | "unknown";

export type Rhythm =
  | "slow_burn"
  | "snappy"
  | "punchy"
  | "story_arc"
  | "listicle"
  | "explainer"
  | "unknown";

export type Audience =
  | "gen_z"
  | "millennials"
  | "parents"
  | "professionals"
  | "hobbyists"
  | "luxury_buyers"
  | "budget_buyers"
  | "creators"
  | "brands"
  | "agencies"
  | "generic";

export type OutputFormat =
  | "angle_only"
  | "brief"
  | "script"
  | "shotlist"
  | "hook_pack"
  | "full_pack";

export type ClaimType = "evidence_grounded" | "reasonable_inference" | "creative_suggestion";

export type SafetyFlag =
  | "none"
  | "needs_review"
  | "sensitive_topic"
  | "medical"
  | "financial"
  | "political"
  | "adult"
  | "violence"
  | "hate"
  | "self_harm"
  | "other";

export interface ProvenanceLink {
  // Reference a specific EvidenceItem.id from MSEOutput.evidence.items
  evidenceId: string;

  // Optional direct URL for quick inspection
  url?: URLString;

  // Optional source for quick UI badges
  source?: SignalSource;
}

export interface GroundedClaim {
  // A single sentence claim used in rationale/briefing
  text: string;

  // Whether the claim is strictly grounded, an inference, or a creative suggestion
  type: ClaimType;

  // Links back to evidence items that support the claim
  support?: ProvenanceLink[];

  // If inference/suggestion, state assumptions plainly
  assumptions?: string[];
}

export interface CreativeContext {
  platform: Platform;
  audience: Audience;

  // Behaviour controls (high-level direction)
  tone: CreativeTone;
  energy: EnergyLevel;
  rhythm: Rhythm;

  // Output requested
  format: OutputFormat;

  // Optional brand constraints (truth-only; do not invent)
  brand?: {
    name?: string;
    product?: string;
    bannedTopics?: string[];
    requiredPhrases?: string[];
    complianceNotes?: string[];
  };
}

export interface Angle {
  id: string;

  // Short, punchy angle headline (UI card title)
  headline: string;

  // What the angle is *doing* (one sentence)
  angleStatement: string;

  // Why it works (2–4 bullets), with grounded claims where possible
  rationale: GroundedClaim[];

  // What to say / show (high-level execution notes)
  execution: {
    hookIdeas: string[]; // short hooks; do not fabricate facts
    keyBeats: string[]; // beat-by-beat outline
    visualIdeas?: string[]; // optional, if requested
    doNots?: string[]; // guardrails
  };

  // Optional: suggested CTA variants (safe)
  ctas?: string[];

  // Confidence in this angle (should never exceed MSE confidence)
  confidence: ConfidenceLevel;

  // Links back to MSE evidence supporting this angle
  provenance: {
    mseMomentId: string;
    decision: DecisionOutcome;
    evidenceLinks: ProvenanceLink[];
  };

  // Safety status for this angle
  safety: {
    flag: SafetyFlag;
    notes?: string[];
  };
}

export interface Brief {
  // A compact strategist-facing brief derived from MSE
  title: string;

  // Truth-only: what is happening (paraphrase grounded)
  what: GroundedClaim[];

  // Truth-only: why it matters (paraphrase grounded)
  why: GroundedClaim[];

  // Target + framing
  audience: Audience;
  platform: Platform;

  // Recommended constraints for creators
  constraints: {
    tone: CreativeTone;
    energy: EnergyLevel;
    rhythm: Rhythm;
    doNots?: string[];
  };

  // Optional “how to act” primitives (still not full scripts)
  actionHints?: string[];

  // Evidence quick refs for UI drawer
  evidenceLinks: ProvenanceLink[];
}

export interface ScriptLine {
  // One line of a script with optional stage direction
  text: string;
  note?: string; // e.g., "(cut to product)", "(whisper)"
  claimType?: ClaimType;
  support?: ProvenanceLink[];
}

export interface Shot {
  // Optional shot list item (CEP-ready later)
  shotNumber: number;
  description: string;
  durationSeconds?: number;
  notes?: string[];
}

export interface Script {
  id: string;
  title: string;

  // 15–60s typical; allow any for now, but keep explicit
  durationSeconds?: number;

  // Script broken into lines for creator usability
  lines: ScriptLine[];

  // Optional shotlist (if requested)
  shots?: Shot[];

  // CTA / endcard suggestion
  cta?: string;

  // Grounding and safety
  provenance: {
    mseMomentId: string;
    evidenceLinks: ProvenanceLink[];
  };
  safety: {
    flag: SafetyFlag;
    notes?: string[];
  };
}

export interface CIEOutput {
  schema: {
    name: "CIE_OUTPUT_SCHEMA";
    version: "D.1";
  };

  generatedAt: ISODateTime;

  // Preserve provenance: embed the minimal MSE identity + confidence
  input: {
    mse: Pick<
      MSEOutput,
      "identity" | "timeWindow" | "labels" | "qualification" | "scores" | "decision"
    >;
  };

  // Creative request context
  context: CreativeContext;

  // Primary deliverables
  brief?: Brief;

  // Multi-angle is core (3–5+)
  angles: Angle[];

  // Optional scripts (only if requested by format)
  scripts?: Script[];

  // Global safety and quality notes
  meta: {
    // Must never exceed the MSE confidence; reflect any uncertainty
    confidence: ConfidenceLevel;

    // If something cannot be supported, record it here
    limitations: string[];

    // Operational notes (truth-only)
    availability?: {
      status: "ok" | "partial" | "unavailable";
      notes?: string[];
    };

    // Provenance convenience: show which evidence items were used at all
    usedEvidenceIds: string[];
  };

  // Optional debug (safe)
  debug?: {
    build?: string;
    notes?: string[];
  };
}

/**
 * Helper: enforce the “CIE confidence cannot exceed MSE confidence” rule
 * at the type level is not possible, but routes/engine should apply it.
 * This function is a tiny utility that can be used without extra deps.
 */
export function clampConfidenceToMSE(cie: ConfidenceLevel, mse: ConfidenceLevel): ConfidenceLevel {
  const rank = (c: ConfidenceLevel): number => (c === "high" ? 3 : c === "medium" ? 2 : 1);

  return rank(cie) > rank(mse) ? mse : cie;
}

/**
 * Helper: derive usedEvidenceIds deterministically from evidence links.
 */
export function collectUsedEvidenceIds(output: CIEOutput): string[] {
  const ids: string[] = [];

  const push = (id: string | undefined): void => {
    if (!id) return;
    if (!ids.includes(id)) ids.push(id);
  };

  output.angles.forEach((a) => {
    a.provenance.evidenceLinks.forEach((l) => push(l.evidenceId));
    a.rationale.forEach((c) => c.support?.forEach((l) => push(l.evidenceId)));
  });

  output.brief?.what.forEach((c) => c.support?.forEach((l) => push(l.evidenceId)));
  output.brief?.why.forEach((c) => c.support?.forEach((l) => push(l.evidenceId)));

  output.scripts?.forEach((s) => {
    s.provenance.evidenceLinks.forEach((l) => push(l.evidenceId));
    s.lines.forEach((ln) => ln.support?.forEach((l) => push(l.evidenceId)));
  });

  return ids;
}
