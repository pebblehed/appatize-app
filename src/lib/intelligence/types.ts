// src/lib/intelligence/types.ts

// High-level input into the intelligence engine
export interface ScriptGenerationInput {
  trendLabel: string;
  objective: string;
  audience: string;
  platform: string;
  briefText: string;

  // Behaviour controls from the BehaviourControlsPanel
  behaviour?: BehaviourControlsInput;
}

// Conceptual energy for angles (kept for angle typing / strategy level)
export type AngleEnergy = "low-key" | "balanced" | "high-energy";

export type NarrativePattern =
  | "opinion"
  | "story"
  | "list"
  | "myth-busting"
  | "how-to"
  | "hot-take";

// ------------------------------
// Stage 4 Behaviour Controls Types
// ------------------------------

// Behaviour energy used by the UI + engine
// Supports both older labels and the new UI labels.
export type BehaviourEnergy =
  | "low-key"
  | "balanced"
  | "high-energy"
  | "low"
  | "steady"
  | "high";

// Tone control (Stage 4 UI)
export type BehaviourTone = "clean" | "warm" | "bold" | "playful";

// Rhythm control (Stage 4 UI + backwards compatibility)
export type BehaviourRhythm =
  | "short"
  | "medium"
  | "narrative"
  | "snappy"
  | "balanced"
  | "story";

// Platform bias (Stage 4 UI + older platformBias name)
export type BehaviourPlatform = "tiktok" | "reels" | "shorts" | "ugc-ad";

// Behaviour controls shape as used in route + UI
export interface BehaviourControlsInput {
  // Energy preference (low/steady/high etc.)
  energy?: BehaviourEnergy;

  // Tone (emotional feel of the delivery)
  tone?: BehaviourTone;

  // Rhythm / pacing of the piece
  rhythm?: BehaviourRhythm;

  // New UI field name
  platform?: BehaviourPlatform;

  // Older field name kept for backwards compatibility
  platformBias?: BehaviourPlatform;

  // Narrative pattern hint (soft guidance)
  narrativePatternBias?: NarrativePattern | "mixed";
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

  // Structured script fields
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
  [key: string]: any;
}

/**
 * Moment-Signal Extraction (MSE) — strategy layer
 * Matches the UI fields in MomentSignalPanel.
 */
export interface MomentSignal {
  coreMoment?: string;        // What is the moment actually about?
  culturalTension?: string;   // What’s the friction / tension in culture?
  stakes?: string;            // Why this moment matters — what’s at stake?
  contentRole?: string;       // What role *this* content should play

  // Can be a single string or an array (as normalised in the route)
  watchouts?: string | string[];

  freshness?: "evergreen" | "timely" | "flash-trend";

  [key: string]: any; // Extendable by engine
}

// What the engine returns to the API route
export interface ScriptGenerationResult {
  angles: AngleWithVariants[];

  // New: cultural snapshot v2 — optional
  snapshot?: CulturalSnapshotPayload;

  // New: Moment-Signal Extraction (MSE)
  momentSignal?: MomentSignal;
}
