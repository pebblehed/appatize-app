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
// A Brief is the governed handoff into the intelligence layer.
export interface Brief {
  id: string;

  // ✅ Stage D.4 governance
  // This must reference a qualified moment stored in moment memory.
  momentId?: string;

  title: string;
  objective?: string;
  trendLabel?: string;
  audience?: string;
  platformHint?: string;
  platformOverride?: string;
  enhancedBrief?: string;
  description?: string;

  // Allow extra properties without breaking older flows
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
   * and creates/updates an active brief that flows into
   * /api/scripts/intelligence with proper provenance.
   */
  generateBriefFromAngle: (trend: any, angle: AngleLike) => void;
};

const BriefContext = createContext<BriefContextValue | undefined>(undefined);

/**
 * Stage D.4: resolve canonical momentId from a trend payload.
 *
 * Contract:
 * - Prefer trend.momentId (canonical)
 * - Allow trend.id ONLY if upstream uses id === momentId (early hardening)
 * - Never invent IDs. Return null if none.
 */
function resolveMomentIdFromTrend(trend: any): string | null {
  const a =
    typeof trend?.momentId === "string" && trend.momentId.trim()
      ? trend.momentId.trim()
      : null;

  const b =
    typeof trend?.id === "string" && trend.id.trim() ? trend.id.trim() : null;

  return a ?? b ?? null;
}

export function BriefProvider({ children }: { children: ReactNode }) {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [activeBrief, setActiveBrief] = useState<Brief | null>(null);

  // Global Behaviour Controls state (Stage 4 shaping)
  const [behaviourControls, setBehaviourControls] =
    useState<BehaviourControlsState>(null);

  /**
   * Trend + Angle → Brief
   *
   * CRITICAL FIX:
   * - If user selects a NEW trend/moment, we MUST create a new governed brief.
   * - We must NOT reuse the existing activeBrief (it would preserve old momentId).
   */
  const generateBriefFromAngle = (trend: any, angle: AngleLike) => {
    const resolvedMomentId = trend ? resolveMomentIdFromTrend(trend) : null;

    const activeMomentId =
      typeof activeBrief?.momentId === "string" && activeBrief.momentId.trim()
        ? activeBrief.momentId.trim()
        : null;

    const isSameMoment =
      resolvedMomentId && activeMomentId
        ? resolvedMomentId === activeMomentId
        : false;

    // Only reuse activeBrief if we're still on the SAME governed moment.
    // If moment changes, we start a fresh brief from the new trend.
    const shouldReuseActiveBrief = Boolean(activeBrief && (!trend || isSameMoment));

    const baseBrief: Brief | null = shouldReuseActiveBrief
      ? activeBrief
      : trend
        ? {
            // Local brief id (UI identity)
            id:
              typeof trend?.id === "string" && trend.id.trim()
                ? trend.id.trim()
                : `trend-${Date.now()}`,

            // ✅ Governed moment reference (Stage D.4)
            momentId: resolvedMomentId ?? undefined,

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

            // Optional traceability (debug provenance quickly)
            __sourceTrendId: trend?.id ?? null,
            __sourceMomentId: resolvedMomentId ?? null,
          }
        : null;

    const newBrief = buildBriefFromAngle(angle, baseBrief);

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
 *
 * NOTE:
 * - We preserve momentId from baseBrief.
 * - This function must NEVER invent or guess a momentId.
 */
function buildBriefFromAngle(angle: AngleLike, baseBrief: Brief | null): Brief {
  const safeBase: Brief =
    baseBrief ?? {
      id: angle.id || "angle-brief",
      title: angle.title || "Angle-selected brief",
    };

  const mergedDescription = safeBase.enhancedBrief || safeBase.description || "";

  const angleSummaryParts: string[] = [];

  if (angle.pov) angleSummaryParts.push(`POV: ${angle.pov}`);
  if (angle.culturalTrigger)
    angleSummaryParts.push(`Cultural trigger: ${angle.culturalTrigger}`);
  if (angle.audienceHook)
    angleSummaryParts.push(`Audience hook: ${angle.audienceHook}`);
  if (angle.narrativePattern)
    angleSummaryParts.push(`Narrative pattern: ${angle.narrativePattern}`);
  if (angle.energy) angleSummaryParts.push(`Energy: ${angle.energy}`);

  const angleSummary =
    angleSummaryParts.length > 0
      ? `\n\n[Selected angle]\n${angleSummaryParts.join("\n")}`
      : "";

  return {
    ...safeBase,

    // Preserve identity + governance
    id: safeBase.id,
    momentId: safeBase.momentId,

    title: safeBase.title || angle.title || "Angle-selected brief",
    trendLabel: safeBase.trendLabel ?? angle.title ?? safeBase.title,
    platformHint: safeBase.platformHint ?? angle.platform ?? safeBase.platformHint,

    enhancedBrief:
      mergedDescription.length > 0
        ? `${mergedDescription}${angleSummary}`
        : angleSummary || mergedDescription,

    // Optional traceability
    selectedAngleId: angle.id,
    selectedAngleTitle: angle.title,
    selectedAnglePov: angle.pov,
  };
}
