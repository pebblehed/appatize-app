// src/context/BriefContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";

/**
 * Core engine types
 */

export type TrendStatus = "Emerging" | "Peaking" | "Stable";

// Stage 3.4: Decision & evidence surfacing types (optional fields only)
export type DecisionState = "ACT" | "WAIT" | "REFRESH";
export type ConfidenceTrajectory = "ACCELERATING" | "STABLE" | "WEAKENING" | "VOLATILE";
export type SignalStrength = "WEAK" | "MODERATE" | "STRONG";

export interface TrendEvidence {
  signalCount: number;
  sourceCount: number;
  firstSeenAt?: string;
  lastConfirmedAt?: string;

  // Optional derived values (only if you choose to add later)
  ageHours?: number;
  recencyMins?: number;
  velocityPerHour?: number;
}

export interface Trend {
  id: string;
  status: TrendStatus;
  name: string; // canonical trend name (what ScriptsPage will use)
  description: string;
  formatLabel: string;
  momentumLabel: string;
  category?: string;

  // Optional debug fields for validation (safe to omit in production)
  debugScore?: number;
  debugVolume?: number;

  // Stage 3.4 (optional, read-only, safe to omit)
  decisionState?: DecisionState;
  confidenceTrajectory?: ConfidenceTrajectory;
  signalStrength?: SignalStrength;
  decisionRationale?: string;
  evidence?: TrendEvidence;
}

export interface Angle {
  id: string;
  label: string; // e.g. "Street POV vlogs for founders"
  hook: string; // narrative POV / core idea
  format: string; // e.g. "Short-form video"
  platform: string; // e.g. "TikTok"
  audience: string; // e.g. "Busy founders"
  outcome: string; // e.g. "Drive DMs"
  notes?: string;
}

export interface Brief {
  id: string;
  title: string;

  // Engine core: the originating trend + angle
  trend: Trend;
  angle?: Angle;

  status: "Draft" | "Active" | "Archived";

  // Strategy layer
  summary?: string;
  coreMessage?: string;
  objective?: string;

  // Hints to guide script generation
  audienceHint?: string;
  platformHint?: string;
  formatHint?: string;
  outcomeHint?: string;

  // Explicit override for engine platform (TikTok / X / LinkedIn / Snapchat, etc.)
  // If undefined, the engine infers from platformHint/formatHint.
  platformOverride?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Context value shape
 */

interface BriefContextValue {
  activeBrief: Brief | null;
  setActiveBrief: (brief: Brief | null) => void;
  briefs: Brief[];
  // IMPORTANT: allow both value and functional updater forms
  setBriefs: Dispatch<SetStateAction<Brief[]>>;

  // Engine helper: Trend + Angle → Appatize creative Brief
  generateBriefFromAngle: (trend: Trend, angle: Angle) => Brief;
}

/**
 * Context + Provider
 */

const BriefContext = createContext<BriefContextValue | undefined>(undefined);

export function BriefProvider({ children }: { children: ReactNode }) {
  const [activeBrief, setActiveBrief] = useState<Brief | null>(null);
  const [briefs, setBriefs] = useState<Brief[]>([]);

  const generateBriefFromAngle = (trend: Trend, angle: Angle): Brief => {
    const now = new Date().toISOString();

    const brief: Brief = {
      id: `brief-${trend.id}-${angle.id}-${Date.now()}`,
      title: `${angle.label} • ${trend.name}`,
      trend,
      angle,
      status: "Draft",

      summary: `Angle "${angle.label}" on trend "${trend.name}" targeting ${angle.audience}.`,
      coreMessage:
        angle.hook ||
        "Turn this cultural signal into creator-native content that feels inevitable.",

      objective:
        angle.outcome || "Drive meaningful action from the right audience.",

      audienceHint: angle.audience,
      platformHint: angle.platform,
      formatHint: angle.format,
      outcomeHint: angle.outcome,

      // No override by default – engine uses hints.
      platformOverride: undefined,

      createdAt: now,
      updatedAt: now,
    };

    setActiveBrief(brief);
    setBriefs((prev) => [...prev, brief]);

    return brief;
  };

  return (
    <BriefContext.Provider
      value={{
        activeBrief,
        setActiveBrief,
        briefs,
        setBriefs,
        generateBriefFromAngle,
      }}
    >
      {children}
    </BriefContext.Provider>
  );
}

/**
 * Hook
 */

export function useBriefContext(): BriefContextValue {
  const ctx = useContext(BriefContext);
  if (!ctx) {
    throw new Error("useBriefContext must be used inside BriefProvider");
  }
  return ctx;
}
