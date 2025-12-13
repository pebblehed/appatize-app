// src/lib/intelligence/behaviour.ts
// Thin wrapper exposing internal MSE behaviour helpers to the app.

export type { VariantBehaviourMeta } from "../../../internal/mse/behaviour";
export {
  attachBehaviourToVariant,
  applyBehaviourControls,
} from "../../../internal/mse/behaviour";
