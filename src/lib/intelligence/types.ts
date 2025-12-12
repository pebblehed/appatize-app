// src/lib/intelligence/types.ts
// Shared contract types for Appatize intelligence.
// Keep this in /src (public boundary) so UI + routes + internal engine stay aligned.

/**
 * Conceptual energy for angles (strategy layer).
 * This is what the engine should emit in Angle.energy.
 */
export type AngleEnergy = "low-key" | "balanced" | "high-energy";

export type NarrativePattern =
  | "opinion"
  | "story"
  | "list"
  | "myth-busting"
  | "how-to"
  | "hot-take";

/**
 * Behaviour controls (user intent) — inputs used to shape generation.
 * We accept multiple historical labels for backwards compatibility,
 * but the engine should normalise them before use.
 */
export type BehaviourEnergy =
  | "low-key"
  | "balanced"
  | "high-energy"
  | "low"
  | "steady"
  | "high";

export type BehaviourTone = "clean" | "warm" | "bold" | "playful";

export type BehaviourRhythm =
  | "short"
  | "medium"
  | "narrative"
  | "snappy"
  | "balanced"
  | "story";

export type BehaviourPlatform = "tiktok" | "reels" | "shorts" | "ugc-ad";

/**
 * Behaviour controls shape as used in route + UI.
 * Note: `platformBias` is legacy but still accepted.
 */
export interface BehaviourControlsInput {
  energy?: BehaviourEnergy;
  tone?: BehaviourTone;
  rhythm?: BehaviourRhythm;

  // Current UI field name
  platform?: BehaviourPlatform;

  // Legacy field name (kept for compatibility)
  platformBias?: BehaviourPlatform;

  narrativePatternBias?: NarrativePattern | "mixed";
}

// High-level input into the intelligence engine
export interface ScriptGenerationInput {
  trendLabel: string;
  objective: string;
  audience: string;
  platform: string;
  briefText: string;

  behaviour?: BehaviourControlsInput;
}

// Engine angle object
export interface Angle {
  id: string;
  title: string;
  pov: string;
  platform: string;
  culturalTrigger: string;
  audienceHook: string;
  narrativePattern: NarrativePattern;
  energy: AngleEnergy;
  warnings?: string[];
}

// Structured variants for scripts
export interface StructuredVariant {
  id: string;
  parentAngleId: string;

  hook: string;
  body: string;
  cta?: string;
  outro?: string;

  structureNotes: string;
  confidence: number; // 0–1
}

export interface AngleWithVariants extends Angle {
  variants: StructuredVariant[];
}

// Cultural Snapshot v2 — flexible, future-proof
export interface CulturalSnapshotPayload {
  culturalContext?: string;
  momentInsight?: string;
  flowGuidance?: string;
  creativePrinciple?: string;

  culturalDynamics?: string;
  audienceMood?: string;
  platformStylePulse?: string;
  creativeLevers?: string;

  // Allow unknown future fields without breaking the app
  [key: string]: unknown;
}

/**
 * Moment-Signal Extraction (MSE) — strategy layer
 * Matches the UI fields in MomentSignalPanel.
 */
export interface MomentSignal {
  coreMoment?: string;
  culturalTension?: string;
  stakes?: string;
  contentRole?: string;

  // Normalisation can convert this to string[]
  watchouts?: string | string[];

  freshness?: "evergreen" | "timely" | "flash-trend";

  [key: string]: unknown;
}

// What the engine returns to the API route
export interface ScriptGenerationResult {
  angles: AngleWithVariants[];
  snapshot?: CulturalSnapshotPayload;
  momentSignal?: MomentSignal;
}
