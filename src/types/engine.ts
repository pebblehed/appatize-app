// src/types/engine.ts

export type Trend = {
  id: string;
  name: string;
  summary: string;
  mechanic: string;
  signalStrengthStage: "early" | "growing" | "peaking" | "saturated";
  signalStrengthScore: number;
  platformFit: string[];
  brandFitNotes?: string;
  riskNotes?: string;
};

export type Angle = {
  id: string;
  label: string;
  hook: string;
  format: string;
  platform: string;
  coreSequence: string[]; // beats
  brandFitRationale?: string;
  difficulty?: "low" | "medium" | "high";
  riskLevel?: "low" | "medium" | "high";
  seriesPotentialScore?: number;
};

export type Brief = {
  id: string;
  title: string;
  trend: Trend;
  angle: Angle;
  objective: string;
  primaryAudience: string;
  coreMessage: string;
  toneAndVoice: string[];
  contentRequirements: string[];
  creativeMandatories: string[];
  guardrails: string[];
  successMetrics: string[];
  exampleConcepts: string[];
};
