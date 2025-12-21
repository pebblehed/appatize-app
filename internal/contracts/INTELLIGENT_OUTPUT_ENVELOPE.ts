// /internal/contracts/INTELLIGENT_OUTPUT_ENVELOPE.ts

/**
 * Any downstream intelligence output MUST include this envelope.
 * If it doesn’t, it is not considered a valid Appatize intelligence output.
 */

export interface IntelligenceProvenance {
  momentId: string;
  behaviourVersion: string;
  qualificationHash: string;
}

export interface IntelligentOutputEnvelope<T> {
  provenance: IntelligenceProvenance;
  payload: T;
}
