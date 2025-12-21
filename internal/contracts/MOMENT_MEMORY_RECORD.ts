// /internal/contracts/MOMENT_MEMORY_RECORD.ts

export type MomentLifecycleStatus =
  | "active"
  | "cooling"
  | "historical";

export interface MomentQualificationSnapshot {
  velocityScore: number;        // how fast the signal emerged
  coherenceScore: number;       // internal consistency of signals
  noveltyScore: number;         // distance from recent history
  qualificationThreshold: number;
}

export interface MomentSourceRef {
  source: "hackernews" | "reddit" | "fusion";
  clusterId: string;
}

export interface MomentMemoryRecord {
  momentId: string;
  name: string;

  sources: MomentSourceRef[];

  qualifiedAt: string;          // ISO timestamp
  decayHorizonHours: number;

  lifecycleStatus: MomentLifecycleStatus;

  qualification: MomentQualificationSnapshot;

  behaviourVersion: string;     // hard link to behaviour context
  qualificationHash: string;    // deterministic hash of inputs

  // Immutable by contract
  readonly __writeOnce: true;
}
