// /internal/contracts/BEHAVIOUR_VERSION.ts

export interface BehaviourThresholds {
  minVelocity: number;
  minCoherence: number;
  minNovelty: number;
}

export interface BehaviourVersion {
  behaviourVersion: string;     // e.g. "behaviour_v1.3.0"
  createdAt: string;

  thresholds: BehaviourThresholds;

  description: string;          // human-readable intent
  authoredBy: "system" | "human";

  // No silent edits allowed
  readonly frozen: true;
}
