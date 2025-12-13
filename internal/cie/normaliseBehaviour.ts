// internal/cie/normaliseBehaviour.ts
// Normalises UI behaviour controls into a stable, engine-ready shape.
// This prevents prompt ambiguity (e.g. "steady" vs "balanced") and stops blank outputs.

import type { BehaviourControlsInput } from "../../src/lib/intelligence/types";

export type EngineBehaviour = {
  energy: "low-key" | "balanced" | "high-energy";
  rhythm: "short" | "medium" | "narrative";
  platformBias: "tiktok" | "reels" | "shorts" | "ugc-ad";
  toneHint: string; // descriptive, not an enum (keeps engine flexible)
  narrativePatternBias?: BehaviourControlsInput["narrativePatternBias"];
};

export function normaliseBehaviourForEngine(
  behaviour?: BehaviourControlsInput
): EngineBehaviour {
  // Defaults are intentionally "balanced / medium / ugc-ad"
  const energyRaw = behaviour?.energy;
  const rhythmRaw = behaviour?.rhythm;
  const platformRaw = behaviour?.platform ?? behaviour?.platformBias;
  const toneRaw = behaviour?.tone;

  const energy: EngineBehaviour["energy"] =
    energyRaw === "low" || energyRaw === "low-key"
      ? "low-key"
      : energyRaw === "high" || energyRaw === "high-energy"
      ? "high-energy"
      : // includes "steady" + "balanced" + undefined
        "balanced";

  const rhythm: EngineBehaviour["rhythm"] =
    rhythmRaw === "short" || rhythmRaw === "snappy"
      ? "short"
      : rhythmRaw === "narrative" || rhythmRaw === "story"
      ? "narrative"
      : // includes "balanced" + "medium" + undefined
        "medium";

  const platformBias: EngineBehaviour["platformBias"] =
    platformRaw === "tiktok" || platformRaw === "reels" || platformRaw === "shorts" || platformRaw === "ugc-ad"
      ? platformRaw
      : "ugc-ad";

  // Tone is UI-specific; we translate to descriptive language the model can follow.
  const toneHint =
    toneRaw === "warm"
      ? "warm, human, supportive, conversational"
      : toneRaw === "bold"
      ? "bold, direct, confident, punchy"
      : toneRaw === "playful"
      ? "playful, witty, light, creator-native"
      : // includes "clean" + undefined
        "clean, modern, clear, not salesy, not robotic";

  return {
    energy,
    rhythm,
    platformBias,
    toneHint,
    narrativePatternBias: behaviour?.narrativePatternBias,
  };
}
