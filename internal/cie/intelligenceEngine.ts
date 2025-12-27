// internal/cie/intelligenceEngine.ts

import OpenAI from "openai";
import type {
  ScriptGenerationInput,
  ScriptGenerationResult,
  BehaviourControlsInput,
  BehaviourPlatform,
} from "../../src/lib/intelligence/types";

import {
  checkTriadGuard,
  triadRewriteInstruction,
} from "@internal/cie/style/triadGuard";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are the Cultural Intelligence Engine (CIE) + Moment-Signal Extraction (MSE) layer inside Appatize.

Non-negotiables:
- Output MUST be STRICT JSON (no markdown, no commentary).
- Do NOT output empty strings for any required script fields.
- Every variant MUST contain a real hook + body + structureNotes.
- If uncertain, make a reasonable creative choice rather than leaving blanks.

Quality rules:
- Scripts must feel human and creator-native.
- Be specific to platform + audience.
- Avoid generic content; show cultural awareness and specificity.
- Angles must differ in POV, energy, and narrative pattern.

STYLE GUARD — Triad control:
- Avoid repetitive rule-of-three lists unless it is canonical system semantics.
- Do not use multiple triads in one output; prefer prose or uneven structures when appropriate.
`;

function normaliseBehaviour(
  behaviour?: BehaviourControlsInput
): BehaviourControlsInput | undefined {
  if (!behaviour) return undefined;

  const next: BehaviourControlsInput = { ...behaviour };

  if ((next as any).energy === "low") (next as any).energy = "low-key";
  if ((next as any).energy === "steady") (next as any).energy = "balanced";
  if ((next as any).energy === "high") (next as any).energy = "high-energy";

  if ((next as any).rhythm === "snappy") (next as any).rhythm = "short";
  if ((next as any).rhythm === "balanced") (next as any).rhythm = "medium";
  if ((next as any).rhythm === "story") (next as any).rhythm = "narrative";

  return next;
}

function describeBehaviourInPrompt(behaviour?: BehaviourControlsInput): string {
  if (!behaviour) {
    return "Behaviour controls: default (balanced energy, medium pacing, no explicit platform bias).";
  }

  const parts: string[] = [];

  if ((behaviour as any).energy) {
    parts.push(`Energy: ${(behaviour as any).energy}.`);
  }

  if ((behaviour as any).rhythm) {
    parts.push(`Rhythm: ${(behaviour as any).rhythm}.`);
  }

  const platformBias: BehaviourPlatform | undefined =
    (behaviour as any).platformBias ?? (behaviour as any).platform;

  if (platformBias) {
    parts.push(`Platform bias: ${platformBias}.`);
  }

  if ((behaviour as any).narrativePatternBias) {
    parts.push(`Narrative pattern bias: ${(behaviour as any).narrativePatternBias}.`);
  }

  if ((behaviour as any).tone) {
    parts.push(`Tone: ${(behaviour as any).tone}.`);
  }

  return `Behaviour controls:\n${parts.join("\n")}`;
}

function normaliseAndValidate(parsed: ScriptGenerationResult): ScriptGenerationResult {
  const angles = Array.isArray((parsed as any).angles) ? (parsed as any).angles : [];

  const safeAngles = angles.map((a: any, ai: number) => {
    const angleId = a?.id || `angle-${ai + 1}`;
    const variants = Array.isArray(a?.variants) ? a.variants : [];

    const safeVariants = variants.map((v: any, vi: number) => {
      const id = v?.id || `${angleId}-variant-${vi + 1}`;
      const parentAngleId = v?.parentAngleId || angleId;

      const hook = typeof v?.hook === "string" ? v.hook : "";
      const body = typeof v?.body === "string" ? v.body : "";
      const structureNotes =
        typeof v?.structureNotes === "string" ? v.structureNotes : "";

      if (!hook.trim() || !body.trim() || !structureNotes.trim()) {
        throw new Error(
          `Engine contract violated: blank script fields (angle=${angleId}, variant=${id}).`
        );
      }

      return {
        ...v,
        id,
        parentAngleId,
        hook,
        body,
        structureNotes,
        confidence:
          typeof v?.confidence === "number"
            ? Math.max(0.5, Math.min(1.0, v.confidence))
            : 0.7,
      };
    });

    return {
      ...a,
      id: angleId,
      variants: safeVariants,
    };
  });

  return { ...(parsed as any), angles: safeAngles } as ScriptGenerationResult;
}

/**
 * One-pass TriadGuard enforcement.
 * - Conservative: only triggers when checkTriadGuard() fails.
 * - Never loops. Never retries. Never fabricates empty fields.
 * - Rewrites ONLY the variant text fields, preserving meaning and Stage D semantics.
 */
async function enforceTriadGuardOnVariantsOnce(
  result: ScriptGenerationResult,
  platform: string
): Promise<ScriptGenerationResult> {
  const angles = Array.isArray((result as any).angles) ? (result as any).angles : [];
  if (angles.length === 0) return result;

  let rewroteCount = 0;

  for (const angle of angles) {
    const variants = Array.isArray(angle?.variants) ? angle.variants : [];
    for (const v of variants) {
      const hook = typeof v?.hook === "string" ? v.hook : "";
      const body = typeof v?.body === "string" ? v.body : "";
      const structureNotes = typeof v?.structureNotes === "string" ? v.structureNotes : "";

      const combined = [hook, body, structureNotes].filter(Boolean).join("\n\n").trim();
      if (!combined) continue;

      const g = checkTriadGuard(combined);
      if (g.ok) continue;

      // One rewrite pass (no loops)
      const instruction = triadRewriteInstruction(g.reason ?? "Triad guard failed");

      const rewriteSystem = `
You are rewriting text for Appatize's Cultural Intelligence Engine.
Non-negotiables:
- Output MUST be STRICT JSON (no markdown, no commentary).
- Preserve meaning, facts, intent, and all Stage D semantics exactly.
- Do NOT add new claims.
- Do NOT remove important details.
- Keep it creator-native and human.

STYLE GUARD:
- Reduce AI cadence caused by repeated 3-part lists.
- Keep canonical triads ONLY if they are system semantics (e.g., ACT/WAIT/REFRESH).`;

      const rewriteUser = `
${instruction}

Platform context: ${platform}

Rewrite this variant while preserving meaning:

HOOK:
${hook}

BODY:
${body}

STRUCTURE NOTES:
${structureNotes}

Return STRICT JSON ONLY with this exact shape:
{
  "hook": "REQUIRED",
  "body": "REQUIRED",
  "structureNotes": "REQUIRED"
}

Rules:
- No empty strings.
- Keep the same general message and intent.
- Avoid repeated rule-of-three list cadence.
- JSON only.
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: rewriteSystem },
          { role: "user", content: rewriteUser },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2, // rewrite should be stable, not creative
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) continue;

      try {
        const rewritten = JSON.parse(raw) as {
          hook?: string;
          body?: string;
          structureNotes?: string;
        };

        const newHook = typeof rewritten?.hook === "string" ? rewritten.hook.trim() : "";
        const newBody = typeof rewritten?.body === "string" ? rewritten.body.trim() : "";
        const newNotes =
          typeof rewritten?.structureNotes === "string"
            ? rewritten.structureNotes.trim()
            : "";

        // Enforce non-empty contract: if rewrite fails, keep original (never blank).
        if (newHook && newBody && newNotes) {
          v.hook = newHook;
          v.body = newBody;
          v.structureNotes = newNotes;
          rewroteCount += 1;
        }
      } catch {
        // If rewrite JSON parse fails, keep original (never break output).
        continue;
      }
    }
  }

  // ProDev: keep deterministic, avoid noisy logs if none rewritten
  if (rewroteCount > 0) {
    console.warn(`[TriadGuard] Rewrote ${rewroteCount} variant(s) to reduce triad cadence.`);
  }

  return result;
}

export async function generateAnglesAndVariantsFromBrief(
  input: ScriptGenerationInput
): Promise<ScriptGenerationResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set on the server");
  }

  const behaviour = normaliseBehaviour((input as any).behaviour);
  const behaviourDescription = describeBehaviourInPrompt(behaviour);

  const userPrompt = `
TREND:
${(input as any).trendLabel}

OBJECTIVE:
${(input as any).objective}

AUDIENCE:
${(input as any).audience}

PLATFORM:
${(input as any).platform}

BRIEF:
${(input as any).briefText}

${behaviourDescription}

Return STRICT JSON ONLY with this exact shape:

{
  "angles": [
    {
      "id": "angle-1",
      "title": "Angle title",
      "pov": "chosen POV",
      "platform": "${(input as any).platform}",
      "culturalTrigger": "cultural hook",
      "audienceHook": "why it lands",
      "narrativePattern": "opinion|story|list|myth-busting|how-to|hot-take",
      "energy": "low-key|balanced|high-energy",
      "variants": [
        {
          "id": "angle-1-variant-1",
          "parentAngleId": "angle-1",
          "hook": "REQUIRED",
          "body": "REQUIRED",
          "structureNotes": "REQUIRED",
          "confidence": 0.5
        }
      ]
    }
  ]
}

Rules:
- EXACTLY 3 angles.
- EXACTLY 3 variants per angle.
- No empty strings.
- JSON only.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.55,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No content returned from OpenAI");

  let parsed: ScriptGenerationResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse script generation JSON");
  }

  // 1) Contract validation (existing behaviour)
  const validated = normaliseAndValidate(parsed);

  // 2) TriadGuard enforcement (one-pass, conservative, never breaks output)
  const enforced = await enforceTriadGuardOnVariantsOnce(
    validated,
    String((input as any).platform ?? "tiktok")
  );

  return enforced;
}
