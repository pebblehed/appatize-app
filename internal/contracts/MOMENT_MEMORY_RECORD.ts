// /internal/contracts/MOMENT_MEMORY_RECORD.ts
//
// Stage D.5 adds canonical identity required for drift detection.
// Canonical identity must be deterministic and stable.

export type MomentLifecycleStatus = "active" | "cooling" | "historical";

export interface MomentQualificationSnapshot {
  velocityScore: number; // how fast the signal emerged
  coherenceScore: number; // internal consistency of signals
  noveltyScore: number; // distance from recent history
  qualificationThreshold: number;
}

export interface MomentSourceRef {
  source: "hackernews" | "reddit" | "fusion";
  clusterId: string;
}

export interface MomentCanonicalIdentity {
  /**
   * Deterministic identity tokens derived at qualification time.
   * In single-source HN mode, this MUST be title-dominant.
   */
  signatureKeywords: string[];
  anchorEntities: string[];

  /**
   * Explains which evidence surface we used to build identity.
   * - "title" in single-source mode
   * - "title+summary" in richer multi-source modes
   */
  identityBasis: "title" | "title+summary";
}

export interface MomentMemoryRecord {
  momentId: string;
  name: string;

  sources: MomentSourceRef[];

  qualifiedAt: string; // ISO timestamp
  decayHorizonHours: number;

  lifecycleStatus: MomentLifecycleStatus;

  qualification: MomentQualificationSnapshot;

  behaviourVersion: string; // hard link to behaviour context
  qualificationHash: string; // deterministic hash of inputs

  // Stage D.5 — required for drift detection
  canonical: MomentCanonicalIdentity;

  // Immutable by contract
  readonly __writeOnce: true;
}
