// /internal/cie/assertProvenance.ts

import type { IntelligenceProvenance } from
  "@internal/contracts/INTELLIGENT_OUTPUT_ENVELOPE";

/**
 * Throws if provenance is incomplete.
 * This is how we block untraceable outputs by design.
 */
export function assertProvenance(p: IntelligenceProvenance): void {
  if (!p?.momentId || !p?.behaviourVersion || !p?.qualificationHash) {
    throw new Error(
      "Invalid intelligent output: missing provenance (momentId, behaviourVersion, qualificationHash)"
    );
  }
}
