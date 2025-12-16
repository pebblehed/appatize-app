// internal/mse/angleEngine.ts

import OpenAI from "openai";
import {
  ScriptGenerationInput,
  ScriptGenerationResult,
  BehaviourControlsInput,
  AngleEnergy,
} from "../../src/lib/intelligence/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are the Cultural Intelligence Engine (CIE) inside Appatize, a Cultural Operations Platform.

Your job (Stage D):
- Take a trend + brief (+ soft behaviour controls).
- Generate 3–5 DISTINCT angles.
- For each angle, generate 4–6 structured variants (scripts).
- Also generate a top-level Moment-Signal extraction (MSE) that explains how to play this moment.
- Return STRICTLY VALID JSON that matches the provided TypeScript types.
- No intros, no explanations, no markdown. JSON ONLY.

Requirements:
- Angles must differ in POV, energy, and narrative pattern.
- Variants must all be on-brief AND clearly descendants of their parent angle.
- Scripts should be naturally human, not robotic, not verbose.
- Assume short-form vertical content (TikTok, Reels, Shorts) unless otherwise stated.
- Each variant must be STRUCTURED into hook, body, cta, outro (outro/cta can be omitted if they are not natural for the platform).
- The MomentSignal should describe the tension, stakes, and opportunity around the moment, not generic social media advice.
`;

/**
 * Turn the behaviour controls object into a short textual guide
 * the model can use as soft instructions.
 */
function describeBehaviourControls(behaviour?: BehaviourControlsInput): string {
  if (!behaviour) return "No explicit behaviour controls were set.";

  const parts: string[] = [];

  if (behaviour.energy) {
    const e = (behaviour.energy ?? "balanced") as AngleEnergy;
    if (e === "low-key") {
      parts.push("Energy: low-key (grounded, calm, conversational).");
    } else if (e === "high-energy") {
      parts.push("Energy: high-energy (punchy, animated).");
    } else {
      parts.push("Energy: balanced.");
    }
  }

  if (behaviour.rhythm) {
    if (behaviour.rhythm === "short") {
      parts.push("Rhythm: short — fast beats, minimal build-up.");
    } else if (behaviour.rhythm === "narrative") {
      parts.push("Rhythm: narrative — story arc with room to build.");
    } else {
      parts.push("Rhythm: medium — standard social pacing.");
    }
  }

  if (behaviour.platformBias) {
    const p = behaviour.platformBias;
    if (p === "tiktok") {
      parts.push("Platform bias: TikTok — native trends, POV styles.");
    } else if (p === "reels") {
      parts.push(
        "Platform bias: Instagram Reels — slightly more polished visual tone."
      );
    } else if (p === "shorts") {
      parts.push(
        "Platform bias: YouTube Shorts — hook-driven, can tolerate slightly more explanatory beats."
      );
    } else if (p === "ugc-ad") {
      parts.push(
        "Platform bias: UGC-style ad — native social feel but clearly linked to a product, service, or offer."
      );
    }
  }

  return parts.join("\n");
}

/* ------------------------- Hardening helpers ------------------------- */

/**
 * Keep changes bounded:
 * - We do NOT change contract shape.
 * - We only normalize/validate and gently stabilize quality outputs.
 */

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Remove common model-generated prefixes and keep titles specific.
 * We do NOT attempt heavy rewriting here (bounded change).
 */
function normalizeAngleTitle(rawTitle: string): string {
  let t = normalizeWhitespace(rawTitle);

  // Strip common prefixed labels: "Angle 1:", "Title:", "Hook:", etc.
  t = t.replace(/^(angle|title|idea|concept)\s*[-:#]?\s*\d*\s*[:\-—]?\s*/i, "");
  t = t.replace(/^(pov|hook)\s*[:\-—]\s*/i, "");

  // Strip enclosing quotes
  t = t.replace(/^["'“”]+/, "").replace(/["'“”]+$/, "");

  // If title is still empty, leave as empty (validation below will handle).
  return normalizeWhitespace(t);
}

/**
 * Very light generic-title detector (bounded).
 * If a title is generic, we won't rewrite (that would be speculative),
 * but we will add minimal specificity by appending a stable anchor term
 * if we can infer one from trendLabel (already provided input).
 */
function isGenericTitle(title: string): boolean {
  const t = title.toLowerCase();
  const genericPatterns = [
    "ai tool",
    "new model",
    "startup",
    "the future of",
    "is dead",
    "game changer",
    "everything you need",
    "things you should know",
    "here's why",
    "hot take",
  ];
  if (title.length < 8) return true;
  return genericPatterns.some((p) => t.includes(p));
}

function deriveAnchorFromTrendLabel(trendLabel: string): string {
  const tl = normalizeWhitespace(trendLabel);
  if (!tl) return "";
  // Keep the first 3–6 words max, as a stable “anchor” fragment.
  const words = tl.split(" ").filter(Boolean);
  const anchor = words.slice(0, Math.min(6, words.length)).join(" ");
  return anchor;
}

function normalizeId(raw: unknown, fallback: string): string {
  const s = safeStr(raw);
  const cleaned = normalizeWhitespace(s);
  return cleaned || fallback;
}

function dedupeByNormalizedTitle<T extends { title: string }>(
  items: T[]
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const key = normalizeWhitespace(it.title).toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/**
 * Compute a small quality-based score to stabilize variant confidence.
 * This does not change the shape, only gently clamps/raises confidence
 * when structure is clearly solid (bounded & deterministic).
 */
function heuristicVariantConfidence(v: {
  hook?: unknown;
  body?: unknown;
  cta?: unknown;
  outro?: unknown;
  structureNotes?: unknown;
}): number {
  const hook = safeStr(v.hook);
  const body = safeStr(v.body);
  const cta = safeStr(v.cta);
  const outro = safeStr(v.outro);
  const notes = safeStr(v.structureNotes);

  let score = 0.5;

  const hookWords = normalizeWhitespace(hook).split(" ").filter(Boolean).length;
  const bodyWords = normalizeWhitespace(body).split(" ").filter(Boolean).length;

  // Hook: short and punchy, not empty
  if (hookWords >= 3 && hookWords <= 18) score += 0.12;
  if (hookWords > 0 && hookWords < 3) score -= 0.05;

  // Body: concise but substantive
  if (bodyWords >= 12 && bodyWords <= 90) score += 0.12;
  if (bodyWords > 120) score -= 0.06;

  // Notes present = structure intention
  if (normalizeWhitespace(notes).length >= 12) score += 0.06;

  // Optional: CTA/outro, if present and not generic
  const ctaLower = cta.toLowerCase();
  if (cta && ctaLower.includes("follow for more")) score -= 0.04;
  if (cta && normalizeWhitespace(cta).length >= 8 && !ctaLower.includes("follow for more")) score += 0.03;

  if (outro && normalizeWhitespace(outro).length >= 6) score += 0.02;

  return clamp(score, 0.5, 1.0);
}

/**
 * Post-process model output without changing contract:
 * - Normalize titles & IDs
 * - Clamp and stabilize confidence
 * - Minimal generic-title tightening via trend anchor
 */
function hardenResult(
  parsed: ScriptGenerationResult,
  ctx: { trendLabel: string }
): ScriptGenerationResult {
  const anchor = deriveAnchorFromTrendLabel(ctx.trendLabel);

  const angles = Array.isArray(parsed.angles) ? parsed.angles : [];

  // Normalize angles
  const hardenedAngles = angles
    .map((a, idx) => {
      const angleId = normalizeId((a as any).id, `angle-${idx + 1}`);

      // Normalize title
      let title = normalizeAngleTitle(safeStr((a as any).title));
      if (!title) title = `Angle ${idx + 1}`;

      // Minimal specificity if generic + we have anchor
      if (isGenericTitle(title) && anchor) {
        // bounded: do not invent, just append anchor fragment
        title = normalizeWhitespace(`${title} — ${anchor}`);
      }

      const variants = Array.isArray((a as any).variants) ? (a as any).variants : [];
      const hardenedVariants = variants
        .map((v: any, vIdx: number) => {
          const parentAngleId = angleId;

          const variantId = normalizeId(
            v?.id,
            `${angleId}-variant-${vIdx + 1}`
          );

          const hook = normalizeWhitespace(safeStr(v?.hook));
          const body = normalizeWhitespace(safeStr(v?.body));
          const cta = normalizeWhitespace(safeStr(v?.cta));
          const outro = normalizeWhitespace(safeStr(v?.outro));
          const structureNotes = normalizeWhitespace(safeStr(v?.structureNotes));

          const modelConf = clamp01(typeof v?.confidence === "number" ? v.confidence : 0);
          const heuristicConf = heuristicVariantConfidence({
            hook,
            body,
            cta,
            outro,
            structureNotes,
          });

          // Stabilize: never below 0.5; prefer the better of model vs heuristic.
          const confidence = clamp(Math.max(modelConf, heuristicConf), 0.5, 1.0);

          return {
            ...v,
            id: variantId,
            parentAngleId,
            hook,
            body,
            ...(cta ? { cta } : {}),
            ...(outro ? { outro } : {}),
            structureNotes,
            confidence,
          };
        })
        // bounded: ensure 4–6 variants (clip excess, don’t invent missing)
        .slice(0, 6);

      return {
        ...a,
        id: angleId,
        title,
        // Ensure platform stays populated; do not rewrite content
        platform: safeStr((a as any).platform) || safeStr(parsed?.angles?.[idx]?.platform) || "",
        variants: hardenedVariants,
      };
    })
    // bounded: ensure 3–5 angles (clip excess, don’t invent missing)
    .slice(0, 5);

  const dedupedAngles = dedupeByNormalizedTitle(hardenedAngles);

  return {
    ...parsed,
    angles: dedupedAngles.length >= 3 ? dedupedAngles : hardenedAngles,
    // momentSignal stays optional and untouched (no invented content)
    ...(parsed.momentSignal ? { momentSignal: parsed.momentSignal } : {}),
  };
}

/**
 * Lightweight runtime shape checks (no new deps).
 */
function assertValidShape(parsed: any) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Response is not an object");
  }
  if (!Array.isArray(parsed.angles)) {
    throw new Error("Response missing angles[]");
  }
  if (parsed.angles.length < 1) {
    throw new Error("Response angles[] is empty");
  }
}

/* ------------------------- Main entrypoint ------------------------- */

export async function generateAnglesAndVariantsFromBrief(
  input: ScriptGenerationInput
): Promise<ScriptGenerationResult> {
  const { trendLabel, objective, audience, platform, briefText, behaviour } =
    input;

  if (!process.env.OPENAI_API_KEY) {
    console.error("[angleEngine] Missing OPENAI_API_KEY");
    throw new Error("OPENAI_API_KEY is not set on the server");
  }

  const behaviourDescription = describeBehaviourControls(behaviour);

  const userPrompt = `
TREND:
${trendLabel}

OBJECTIVE:
${objective}

AUDIENCE:
${audience}

PLATFORM:
${platform}

BEHAVIOUR CONTROLS (soft guidance):
${behaviourDescription}

BRIEF (full text / context):
${briefText}

Return JSON of this exact shape (TypeScript):

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

/**
 * Moment-Signal Extraction (MSE)
 * High-level read on the cultural moment and how to play it.
 */
interface MomentSignal {
  coreTension: string;      // What’s actually at stake / in conflict?
  audienceSpark: string;    // Why this hits emotionally for the audience
  culturalFrame: string;    // The bigger cultural story this sits inside
  opportunity: string;      // How the brand/creator can legitimately show up
  riskFlags: string[];      // Watchouts / lines not to cross
  freshness: "evergreen" | "timely" | "flash-trend";
}

interface ScriptGenerationResult {
  angles: AngleWithVariants[];
  momentSignal?: MomentSignal;
}

Rules:
- Generate 3–5 angles.
- For each angle, generate 4–6 variants.
- IDs should be short stable strings (e.g. "angle-1", "angle-1-variant-1").
- confidence should be between 0.5 and 1.0.
- hook must be a thumb-stopping opening line (short).
- body is the core idea / flow, can be bullet-like or paragraph, but concise.
- cta is optional; when present, tie it to the stated OBJECTIVE, not generic "follow for more".
- outro is optional; when present, use a natural ending line suitable for the PLATFORM.
- Script language must be natural and human, specific to the platform.
- The MomentSignal should reference the cultural and emotional reality behind the brief, not generic marketing tips.
- DO NOT wrap the JSON in markdown.
- DO NOT add commentary.
`;

  // Bounded retry: if the model fails shape/JSON once, retry with lower temp.
  const attempts: Array<{ temperature: number; tag: string }> = [
    { temperature: 0.7, tag: "primary" },
    { temperature: 0.3, tag: "retry-lowtemp" },
  ];

  let lastErr: unknown;

  for (const attempt of attempts) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: attempt.temperature,
      });

      const raw = completion.choices[0]?.message?.content;

      if (!raw) {
        console.error("[angleEngine] Empty content from OpenAI", {
          attempt: attempt.tag,
          completion,
        });
        throw new Error("No content returned from OpenAI");
      }

      let parsed: ScriptGenerationResult;
      try {
        parsed = JSON.parse(raw) as ScriptGenerationResult;
      } catch (err) {
        console.error("[angleEngine] Failed to parse JSON", {
          attempt: attempt.tag,
          err,
          raw,
        });
        throw new Error("Failed to parse script generation JSON");
      }

      // Validate minimal shape (bounded)
      assertValidShape(parsed);

      // Harden output deterministically (bounded)
      const hardened = hardenResult(parsed, { trendLabel });

      // Re-check essential shape after hardening
      assertValidShape(hardened);

      return hardened;
    } catch (err) {
      lastErr = err;
      console.error("[angleEngine] Attempt failed", {
        attempt: attempt.tag,
        err,
      });
    }
  }

  // If both attempts fail, throw the last error
  throw lastErr instanceof Error ? lastErr : new Error("Angle generation failed");
}
