// internal/mse/behaviour.ts

import type { BehaviourControls } from "../../src/types/behaviour";
import type { ScriptVariant } from "../../src/components/variant/VariantsTabs";

/**
 * Behaviour metadata we can attach to each variant.
 * This keeps the behaviour that produced the script visible
 * and future-proofs us for more advanced shaping later.
 */
export interface VariantBehaviourMeta extends BehaviourControls {}

/**
 * Attach behaviour meta to a single variant.
 */
export function attachBehaviourToVariant(
  variant: ScriptVariant,
  behaviour: BehaviourControls
): ScriptVariant {
  return {
    ...variant,
    // non-breaking: we just hang behaviour off the variant
    behaviour: {
      ...behaviour,
    } as VariantBehaviourMeta,
  } as ScriptVariant;
}

/**
 * Apply behaviour metadata to a list of variants.
 * Currently this is a pure annotation – the *actual* shaping
 * is driven inside the model prompt using these same controls.
 */
export function applyBehaviourControls(
  variants: ScriptVariant[],
  behaviour: BehaviourControls | null | undefined
): ScriptVariant[] {
  if (!behaviour) return variants;
  return variants.map((v) => attachBehaviourToVariant(v, behaviour));
}
