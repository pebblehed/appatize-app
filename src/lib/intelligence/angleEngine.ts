// src/lib/intelligence/angleEngine.ts

import OpenAI from "openai";
import {
  ScriptGenerationInput,
  ScriptGenerationResult,
  BehaviourControlsInput,
} from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are the Cultural Intelligence Engine (CIE) inside Appatize, a Cultural Operations Platform.

Your job on every call:

1) Read the trend + brief + behaviour controls.
2) Generate 3–5 DISTINCT angles.
3) For each angle, generate 4–6 STRUCTURED variants (hook, body, cta, outro).
4) Generate a CULTURAL SNAPSHOT that explains the cultural dynamics
   around this moment for the brand/creator.
5) Generate a MOMENT SIGNAL block that explains how to "play" this moment
   strategically (what's at stake, tension, role of content, watchouts).

You MUST return STRICTLY VALID JSON matching this shape (no markdown, no comments):

{
  "angles": AngleWithVariants[],
  "snapshot": CulturalSnapshotPayload,
  "momentSignal": MomentSignal
}

Types (for reference only):

type AngleEnergy = "low-key" | "balanced" | "high-energy";
type NarrativePattern =
  | "opinion"
  | "story"
  | "list"
  | "myth-busting"
  | "how-to"
  | "hot-take";

interface Angle {
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

interface StructuredVariant {
  id: string;
  parentAngleId: string;
  hook: string;
  body: string;
  cta?: string;
  outro?: string;
  structureNotes: string;
  confidence: number; // 0–1
}

interface AngleWithVariants extends Angle {
  variants: StructuredVariant[];
}

interface CulturalSnapshotPayload {
  culturalContext?: string;
  momentInsight?: string;
  flowGuidance?: string;
  creativePrinciple?: string;
  culturalDynamics?: string;
  audienceMood?: string;
  platformStylePulse?: string;
  creativeLevers?: string;
}

interface MomentSignal {
  coreMoment?: string;
  culturalTension?: string;
  stakes?: string;
  contentRole?: string;
  watchouts?: string;
}

Rules:

- Angles must differ in POV, energy, and narrative pattern.
- Variants must all be on-brief AND clearly linked to their parent angle.
- Scripts should be naturally human, not robotic, not verbose.
- Assume short-form vertical content (TikTok, Reels, Shorts) unless otherwise stated.
- Each variant must be structured into hook, body, cta (optional), outro (optional).
- "confidence" should be between 0.5 and 1.0.

CULTURAL SNAPSHOT:

- "culturalDynamics": Where this sits in the wider cultural story.
- "culturalContext": A fast read on the specific context for this brief.
- "audienceMood": How the audience feels about this topic right now.
- "platformStylePulse": How this moment shows up on the chosen platform(s).
- "creativeLevers": The most effective creative moves to pull.
- "flowGuidance": How to shape narrative flow given platform + energy + rhythm.
- "creativePrinciple": The POV or principle the creator/brand should stay anchored to.
- "momentInsight": The single most important insight about this moment.

MOMENT SIGNAL (MSE):

- "coreMoment": In one or two sentences, what moment are we really stepping into?
- "culturalTension": The key push/pull, friction, or contradiction in this moment.
- "stakes": Why this matters emotionally or reputationally if the creator/brand gets it right or wrong.
- "contentRole": What role the content should play (e.g. soothe, provoke, reframe, celebrate).
- "watchouts": Specific pitfalls to avoid (tone-deaf angles, overclaims, cliches, disrespectful framings).

Return JSON ONLY. No explanations, no markdown.
`;

function summariseBehaviour(behaviour?: BehaviourControlsInput | null): string {
  if (!behaviour) return "No explicit behaviour controls. Use a natural, on-brief default.";

  const parts: string[] = [];

  if (behaviour.energy) {
    if (behaviour.energy === "low-key") {
      parts.push("Energy: low-key, calmer and grounded.");
    } else if (behaviour.energy === "high-energy") {
      parts.push("Energy: high-energy, more animated and vivid.");
    } else {
      parts.push("Energy: balanced, natural social tone.");
    }
  }

  if (behaviour.rhythm) {
    if (behaviour.rhythm === "short") {
      parts.push("Rhythm: short, punchy beats for fast scroll-stopping hooks.");
    } else if (behaviour.rhythm === "narrative") {
      parts.push("Rhythm: slower, narrative arc with a bit more build.");
    } else {
      parts.push("Rhythm: medium, standard social pacing.");
    }
  }

  if (behaviour.platformBias) {
    const label =
      behaviour.platformBias === "tiktok"
        ? "TikTok"
        : behaviour.platformBias === "reels"
        ? "Instagram Reels"
        : behaviour.platformBias === "shorts"
        ? "YouTube Shorts"
        : "UGC-style ads";

    parts.push(`Platform style bias: lean into ${label} norms without copying trends blindly.`);
  }

  return parts.join(" ");
}

export async function generateAnglesAndVariantsFromBrief(
  input: ScriptGenerationInput
): Promise<ScriptGenerationResult> {
  const { trendLabel, objective, audience, platform, briefText, behaviour } =
    input;

  if (!process.env.OPENAI_API_KEY) {
    console.error("[angleEngine] Missing OPENAI_API_KEY");
    throw new Error("OPENAI_API_KEY is not set on the server");
  }

  const behaviourSummary = summariseBehaviour(behaviour);

  const userPrompt = `
TREND LABEL:
${trendLabel}

OBJECTIVE:
${objective}

AUDIENCE:
${audience}

PRIMARY PLATFORM:
${platform}

BRIEF (expanded):
${briefText}

BEHAVIOUR CONTROLS (soft guidance from the UI):
${behaviourSummary}

TASK:

1) Propose 3–5 distinct angles for short-form content that truly fit this moment.
2) For each angle, generate 4–6 script variants, each with:
   - hook (thumb-stopping opening line)
   - body (core idea / flow, concise)
   - cta (optional, tied to the OBJECTIVE, not generic)
   - outro (optional, natural platform-specific close)
   - structureNotes (1–2 lines on how this variant is structured)
   - confidence (0.5–1.0, your belief that this will perform strongly)

3) Generate a CulturalSnapshotPayload grounded in this brief AND the angles:
   - culturalDynamics
   - culturalContext
   - audienceMood
   - platformStylePulse
   - creativeLevers
   - flowGuidance
   - creativePrinciple
   - momentInsight

4) Generate a MomentSignal:
   - coreMoment
   - culturalTension
   - stakes
   - contentRole
   - watchouts

Remember:
- Make angles meaningfully different in POV, energy and narrative pattern.
- Keep language human, platform-native, and not overly verbose.
- DO NOT wrap the JSON in markdown.
- DO NOT add any commentary outside the JSON.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.75,
  });

  const raw = completion.choices[0].message.content;

  if (!raw) {
    console.error("[angleEngine] Empty content from OpenAI", completion);
    throw new Error("No content returned from OpenAI");
  }

  let parsed: ScriptGenerationResult;
  try {
    parsed = JSON.parse(raw) as ScriptGenerationResult;
  } catch (err) {
    console.error("[angleEngine] Failed to parse JSON", err, raw);
    throw new Error("Failed to parse script generation JSON");
  }

  if (!parsed.angles || !Array.isArray(parsed.angles)) {
    console.error("[angleEngine] Parsed JSON missing angles[]", parsed);
    throw new Error("Invalid script generation response shape");
  }

  return parsed;
}
