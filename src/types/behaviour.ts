// src/types/behaviour.ts

// Energy / intensity of the script delivery
export type EnergyLevel = "low" | "balanced" | "high";

// Voice personality
export type ToneProfile =
  | "authentic"
  | "cinematic"
  | "educational"
  | "opinionated"
  | "humorous";

// Pace + structure density
export type RhythmProfile = "short" | "medium" | "narrative";

// Platform-native behaviour
export type PlatformMode = "tiktok" | "reels" | "shorts" | "ugc_ad";

export interface BehaviourControls {
  energy: EnergyLevel;
  tone: ToneProfile;
  rhythm: RhythmProfile;
  platformMode: PlatformMode;
}

// Safest “default Appatize” behaviour
export const defaultBehaviour: BehaviourControls = {
  energy: "balanced",
  tone: "authentic",
  rhythm: "medium",
  platformMode: "tiktok",
};
