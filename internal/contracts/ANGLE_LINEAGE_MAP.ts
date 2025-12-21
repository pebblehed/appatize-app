// /internal/contracts/ANGLE_LINEAGE_MAP.ts

export interface AngleLineageNode {
  angleId: string;
  momentId: string;

  rationale: string;            // why this angle existed *then*
  createdAt: string;            // ISO timestamp

  parentAngleId?: string;       // lineage tracking
}

export interface AngleLineageMap {
  angleId: string;
  lineage: AngleLineageNode[];

  // Guardrail: angles cannot exist without a moment
  originatingMomentId: string;
}
