// internal/mse/promptBuilder.ts

import type { ScriptGenerationInput } from "../../src/lib/intelligence/types";

export function buildIntelligencePrompt(input: ScriptGenerationInput) {
  const { trendLabel, objective, audience, platform, briefText, behaviour } =
    input;

  // Prodev safety: behaviour can be null/undefined depending on upstream usage.
  // We default to sensible values so prompt building never throws.
  const safeBehaviour = behaviour ?? {
    energy: "balanced",
    tone: "authentic",
    rhythm: "medium",
    platform: platform ?? "tiktok",
  };

  // Behaviour → creative shaping maps
  const energyMap = {
    low: "calm, reflective, minimal activation energy",
    balanced: "natural, steady, non-forced creative energy",
    high: "fast-paced, high-activation, high-impact creative energy",
  } as const;

  const toneMap = {
    authentic: "raw, first-person, honest delivery",
    cinematic: "polished, visually evocative storytelling",
    educational: "clear, concise, educational communication",
    opinionated: "strong point-of-view commentary",
    humorous: "light, witty, comedic framing",
  } as const;

  const rhythmMap = {
    short: "1–2 punchy beats, very tight pacing",
    medium: "3–4 beats, natural progression",
    narrative: "micro-story arc with beginning, middle, and end",
  } as const;

  const energyKey = safeBehaviour.energy as keyof typeof energyMap;
  const toneKey = safeBehaviour.tone as keyof typeof toneMap;
  const rhythmKey = safeBehaviour.rhythm as keyof typeof rhythmMap;

  return `
You are the Cultural Intelligence Engine (CIE) inside Appatize.

Your task is to analyse the brief and generate:
- 3–5 DISTINCT angles
- 4–6 variants per angle
- Strict JSON only
- Each variant MUST include: hook, body, cta (optional), outro (optional)

ANGULAR REQUIREMENTS:
- Each angle must differ in POV, narrative pattern, energy, tone, and style.
- Angles MUST reflect the user's behaviour settings as creative boundaries.

BEHAVIOUR SETTINGS (user intent):
Energy: ${safeBehaviour.energy} → ${energyMap[energyKey]}
Tone: ${safeBehaviour.tone} → ${toneMap[toneKey]}
Rhythm: ${safeBehaviour.rhythm} → ${rhythmMap[rhythmKey]}
Platform Override: ${safeBehaviour.platform}

These must influence:
- pacing
- linguistic style
- POV selection
- narrative structure
- hook style
- CTA strength
- emotional temperature
- cultural expression

BRIEF:
${briefText}

TREND: ${trendLabel}
OBJECTIVE: ${objective}
AUDIENCE: ${audience}
PLATFORM: ${platform}

OUTPUT STRICTLY AS JSON:
{
  "angles": [
    {
      "id": "angle-1",
      "title": "Angle title",
      "pov": "chosen POV",
      "platform": "${safeBehaviour.platform}",
      "culturalTrigger": "reason this angle is culturally relevant",
      "audienceHook": "why this lands for this audience",
      "narrativePattern": "pattern used",
      "energy": "low-key | balanced | high-energy",

      "variants": [
        {
          "id": "angle-1-variant-1",
          "parentAngleId": "angle-1",
          "hook": "short, thumb-stopping",
          "body": "core content",
          "cta": "optional CTA",
          "outro": "optional ending line",
          "structureNotes": "why this structure works",
          "confidence": 0.5-1.0
        }
      ]
    }
  ]
}
`;
}
