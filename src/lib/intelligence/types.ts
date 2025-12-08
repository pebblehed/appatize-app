// src/lib/intelligence/types.ts

// High-level input into the intelligence engine
export interface ScriptGenerationInput {
  trendLabel: string;
  objective: string;
  audience: string;
  platform: string;
  briefText: string;

  // Soft directional guidance from Behaviour Controls
  behaviour?: BehaviourControlsInput;
}

export type AngleEnergy = "low-key" | "balanced" | "high-energy";

export type NarrativePattern =
  | "opinion"
  | "story"
  | "list"
  | "myth-busting"
  | "how-to"
  | "hot-take";

// Behaviour Controls as the engine sees them
export interface BehaviourControlsInput {
  /**
   * Global energy of the scripts.
   * - "low-key": calmer, grounded
   * - "balanced": natural, default
   * - "high-energy": punchier, more animated
   */
  energy?: AngleEnergy;

  /**
   * Rhythm / pacing of the content.
   * - "short": very tight beats, fast scroll stopper
   * - "medium": standard social pacing
   * - "narrative": more story arc, slightly longer beats
   */
  rhythm?: "short" | "medium" | "narrative";

  /**
   * Platform bias to nudge style without hard-locking.
   * - "tiktok" | "reels" | "shorts" | "ugc-ad"
   */
  platformBias?: "tiktok" | "reels" | "shorts" | "ugc-ad";
}

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

// What the engine returns to the API route
export interface CulturalSnapshotPayload {
  culturalContext?: string;
  momentInsight?: string;
  flowGuidance?: string;
  creativePrinciple?: string;

  culturalDynamics?: string;
  audienceMood?: string;
  platformStylePulse?: string;
  creativeLevers?: string;
}

/**
 * Moment-Signal Extraction (MSE) payload — “how to play this moment”.
 * This feeds the MomentSignalPanel on the Scripts page.
 */
export interface MomentSignal {
  coreMoment?: string;
  culturalTension?: string;
  stakes?: string;
  contentRole?: string;
  watchouts?: string;
}

export interface ScriptGenerationResult {
  angles: AngleWithVariants[];

  /**
   * Optional top-level snapshot of the cultural intelligence
   * for this brief + behaviour configuration.
   */
  snapshot?: CulturalSnapshotPayload;

  /**
   * Optional strategic read on the moment, used by MomentSignalPanel.
   */
  momentSignal?: MomentSignal;
}
