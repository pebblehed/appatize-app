// src/context/BriefContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { BehaviourControlsInput } from "@/lib/intelligence/types";

// 🔹 Core brief shape for the app.
export interface Brief {
  id: string;
  title: string;
  objective?: string;
  trendLabel?: string;
  audience?: string;
  platformHint?: string;
  platformOverride?: string;
  enhancedBrief?: string;
  description?: string;
  // Allow extra properties
  [key: string]: any;
}

// Minimal shape of an angle coming from the engine / UI.
type AngleLike = {
  id?: string;
  title?: string;
  pov?: string;
  platform?: string;
  culturalTrigger?: string;
  audienceHook?: string;
  narrativePattern?: string;
  energy?: string;
  // Loose bag for anything else coming from the engine
  [key: string]: any;
};

// 🔹 Exported so AngleCard can import `type Angle`
export type Angle = AngleLike;

type BehaviourControlsState = BehaviourControlsInput | null;

type BriefContextValue = {
  briefs: Brief[];
  setBriefs: (briefs: Brief[]) => void;

  activeBrief: Brief | null;
  setActiveBrief: (brief: Brief | null) => void;

  behaviourControls: BehaviourControlsState;
  setBehaviourControls: (value: BehaviourControlsState) => void;

  /**
   * Used by AngleCard "Use this angle".
   * Takes the currently selected trend + chosen angle
   * and creates/updates an active brief that flows into the
   * intelligence layer on /scripts.
   */
  generateBriefFromAngle: (trend: any, angle: AngleLike) => void;
};

const BriefContext = createContext<BriefContextValue | undefined>(undefined);

export function BriefProvider({ children }: { children: ReactNode }) {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [activeBrief, setActiveBrief] = useState<Brief | null>(null);

  // Global Behaviour Controls state
  const [behaviourControls, setBehaviourControls] =
    useState<BehaviourControlsState>(null);

  /**
   * Trend + Angle → Brief
   *
   * - If an activeBrief exists, we enrich it with the selected angle.
   * - Otherwise, we create a new brief using trend + angle info.
   */
  const generateBriefFromAngle = (trend: any, angle: AngleLike) => {
    // Base brief:
    // - Prefer the current activeBrief (so we keep user edits)
    // - Otherwise, build from the selected trend if present
    const baseBrief: Brief | null =
      activeBrief ??
      (trend
        ? {
            id: trend.id ?? `trend-${Date.now()}`,
            title:
              trend.title ||
              trend.name ||
              angle.title ||
              "Angle-selected brief",
            trendLabel:
              trend.trendLabel ||
              trend.name ||
              trend.title ||
              angle.title,
            platformHint:
              trend.platform ||
              trend.channel ||
              angle.platform ||
              undefined,
          }
        : null);

    // Use the internal helper to merge in angle metadata
    const newBrief = buildBriefFromAngle(angle, baseBrief);

    // Add to list + set active
    setBriefs((prev) => [newBrief, ...prev]);
    setActiveBrief(newBrief);
  };

  const value: BriefContextValue = {
    briefs,
    setBriefs,
    activeBrief,
    setActiveBrief,
    behaviourControls,
    setBehaviourControls,
    generateBriefFromAngle,
  };

  return (
    <BriefContext.Provider value={value}>
      {children}
    </BriefContext.Provider>
  );
}

export function useBriefContext(): BriefContextValue {
  const ctx = useContext(BriefContext);
  if (!ctx) {
    throw new Error("useBriefContext must be used within a BriefProvider");
  }
  return ctx;
}

/**
 * buildBriefFromAngle (internal helper)
 *
 * Takes the chosen angle + a base brief and returns a new brief
 * enriched with angle metadata, ready for the intelligence layer.
 */
function buildBriefFromAngle(
  angle: AngleLike,
  baseBrief: Brief | null
): Brief {
  const safeBase: Brief =
    baseBrief ?? {
      id: angle.id || "angle-brief",
      title: angle.title || "Angle-selected brief",
    };

  const mergedDescription =
    safeBase.enhancedBrief ||
    safeBase.description ||
    "";

  const angleSummaryParts: string[] = [];

  if (angle.pov) {
    angleSummaryParts.push(`POV: ${angle.pov}`);
  }
  if (angle.culturalTrigger) {
    angleSummaryParts.push(`Cultural trigger: ${angle.culturalTrigger}`);
  }
  if (angle.audienceHook) {
    angleSummaryParts.push(`Audience hook: ${angle.audienceHook}`);
  }
  if (angle.narrativePattern) {
    angleSummaryParts.push(`Narrative pattern: ${angle.narrativePattern}`);
  }
  if (angle.energy) {
    angleSummaryParts.push(`Energy: ${angle.energy}`);
  }

  const angleSummary =
    angleSummaryParts.length > 0
      ? `\n\n[Selected angle]\n${angleSummaryParts.join("\n")}`
      : "";

  return {
    ...safeBase,
    id: safeBase.id,
    title: safeBase.title || angle.title || "Angle-selected brief",
    trendLabel: safeBase.trendLabel ?? angle.title ?? safeBase.title,
    platformHint:
      safeBase.platformHint ?? angle.platform ?? safeBase.platformHint,
    enhancedBrief:
      mergedDescription.length > 0
        ? `${mergedDescription}${angleSummary}`
        : angleSummary || mergedDescription,
    selectedAngleId: angle.id,
    selectedAngleTitle: angle.title,
    selectedAnglePov: angle.pov,
  };
}
