// internal/contracts/CIE_OUTPUT_SCHEMA.ts
/**
 * Appatize Internal Contract: CIE Output Schema (Stage D)
 *
 * Purpose:
 * - Provide a single, strict runtime validator for the CIE engine output.
 * - Prevent silent “empty scripts” failures by rejecting malformed payloads early.
 * - Keep this internal contract stable even as UI evolves.
 *
 * No external deps. Pure TypeScript type guards.
 */

import type {
  ScriptGenerationResult,
  AngleWithVariants,
  StructuredVariant,
  MomentSignal,
  CulturalSnapshotPayload,
} from "../../src/lib/intelligence/types";

export const CIE_OUTPUT_SCHEMA_VERSION = "stage-d/v1";

/** Narrow unknown → record */
function isRecord(val: unknown): val is Record<string, any> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function isString(val: unknown): val is string {
  return typeof val === "string";
}

function isNumber(val: unknown): val is number {
  return typeof val === "number" && !Number.isNaN(val);
}

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every(isString);
}

/**
 * Validate a StructuredVariant.
 * We require: id, parentAngleId, hook, body, structureNotes, confidence.
 * CTA/outro are optional.
 */
function isStructuredVariant(v: unknown): v is StructuredVariant {
  if (!isRecord(v)) return false;

  // Required string fields
  if (!isString(v.id)) return false;
  if (!isString(v.parentAngleId)) return false;
  if (!isString(v.hook)) return false;
  if (!isString(v.body)) return false;
  if (!isString(v.structureNotes)) return false;

  // Confidence must be a number (0..1 is ideal; we validate number here)
  if (!isNumber(v.confidence)) return false;

  // Optional string fields
  if (v.cta !== undefined && v.cta !== null && !isString(v.cta)) return false;
  if (v.outro !== undefined && v.outro !== null && !isString(v.outro))
    return false;

  return true;
}

/**
 * Validate an AngleWithVariants.
 * We require: id, title, pov, platform, culturalTrigger, audienceHook,
 * narrativePattern, energy, variants[].
 *
 * NOTE: narrativePattern/energy are string unions at type level; here we enforce "string".
 * (We can tighten to exact unions later once everything is stable.)
 */
function isAngleWithVariants(a: unknown): a is AngleWithVariants {
  if (!isRecord(a)) return false;

  if (!isString(a.id)) return false;
  if (!isString(a.title)) return false;
  if (!isString(a.pov)) return false;
  if (!isString(a.platform)) return false;
  if (!isString(a.culturalTrigger)) return false;
  if (!isString(a.audienceHook)) return false;

  if (!isString(a.narrativePattern)) return false;
  if (!isString(a.energy)) return false;

  if (!Array.isArray(a.variants)) return false;
  if (!a.variants.every(isStructuredVariant)) return false;

  // Optional warnings
  if (a.warnings !== undefined && a.warnings !== null && !isStringArray(a.warnings))
    return false;

  return true;
}

function isCulturalSnapshotPayload(s: unknown): s is CulturalSnapshotPayload {
  if (!isRecord(s)) return false;
  // All keys are optional and can be strings/any; we just ensure it’s an object.
  return true;
}

function isMomentSignal(m: unknown): m is MomentSignal {
  if (!isRecord(m)) return false;

  // All optional; only validate types if present
  if (m.coreMoment !== undefined && m.coreMoment !== null && !isString(m.coreMoment))
    return false;
  if (
    m.culturalTension !== undefined &&
    m.culturalTension !== null &&
    !isString(m.culturalTension)
  )
    return false;
  if (m.stakes !== undefined && m.stakes !== null && !isString(m.stakes)) return false;
  if (
    m.contentRole !== undefined &&
    m.contentRole !== null &&
    !isString(m.contentRole)
  )
    return false;

  if (m.watchouts !== undefined && m.watchouts !== null) {
    const ok =
      isString(m.watchouts) ||
      (Array.isArray(m.watchouts) && m.watchouts.every(isString));
    if (!ok) return false;
  }

  if (m.freshness !== undefined && m.freshness !== null && !isString(m.freshness))
    return false;

  return true;
}

/**
 * Strict validator for the engine output.
 * If this returns false, we should treat the engine response as invalid.
 */
export function isCieGenerationResult(val: unknown): val is ScriptGenerationResult {
  if (!isRecord(val)) return false;

  if (!Array.isArray(val.angles)) return false;
  if (!val.angles.every(isAngleWithVariants)) return false;

  if (val.snapshot !== undefined && val.snapshot !== null) {
    if (!isCulturalSnapshotPayload(val.snapshot)) return false;
  }

  if (val.momentSignal !== undefined && val.momentSignal !== null) {
    if (!isMomentSignal(val.momentSignal)) return false;
  }

  return true;
}

/**
 * Assert helper with a clear error message.
 * Use this in routes so failures are obvious and logged.
 */
export function assertCieGenerationResult(val: unknown): ScriptGenerationResult {
  if (!isCieGenerationResult(val)) {
    throw new Error(
      `[CIE_OUTPUT_SCHEMA ${CIE_OUTPUT_SCHEMA_VERSION}] Invalid engine output shape`
    );
  }
  return val;
}
