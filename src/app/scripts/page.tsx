// src/app/scripts/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useBriefContext } from "@/context/BriefContext";
import VariantTabs, { type ScriptVariant } from "@/components/variant/VariantsTabs";
import ScriptOutput from "./ScriptOutput";
import { cleanText } from "@/engine/cleanText";
import AngleTabs from "@/components/scripts/AngleTabs";
import CulturalSnapshot from "@/components/scripts/CulturalSnapshot";
import MomentSignalPanel from "@/components/scripts/MomentSignalPanel";
import BehaviourControlsPanel from "@/components/scripts/BehaviourControlsPanel";
import type { BehaviourControlsInput } from "@/lib/intelligence/types";

type CulturalInsight = {
  culturalContext?: string;
  momentInsight?: string;
  flowGuidance?: string;
  creativePrinciple?: string;
};

type AngleGroup = {
  key: string; // grouping key (we'll use angleName)
  title: string; // raw angle title from the engine
  label: string; // "Angle A: Street POV micro-vlogs"
};

// Moment signal shape used by the UI
type MomentSignalData = {
  coreMoment?: string;
  culturalTension?: string;
  stakes?: string;
  contentRole?: string;
  watchouts?: string;
} | null;

// Local default behaviour profile
const DEFAULT_BEHAVIOUR: BehaviourControlsInput = {
  energy: "steady" as any,
  tone: "clean" as any,
  rhythm: "balanced" as any,
  platform: "ugc-ad" as any,
};

// --- Stage D response types from /api/scripts/intelligence ---

type IntelligenceFail = {
  ok: false;
  error: {
    code: string;
    message: string;
    meta?: Record<string, unknown>;
  };
};

type IntelligenceOk = {
  ok: true;
  variants: Array<{
    id?: string;
    label?: string;
    body?: string;
    angleName?: string;
    notes?: string;
    score?: number;

    // optional structured fields (backend may include)
    hook?: string;
    mainBody?: string;
    cta?: string;
    outro?: string;
  }>;
  cultural?: CulturalInsight | null;
  momentSignal?: any;
  // optional canonical engine output for future use
  result?: any;
};

type IntelligenceResponse = IntelligenceOk | IntelligenceFail;

export default function ScriptsPage() {
  const { activeBrief } = useBriefContext();

  const [variants, setVariants] = useState<ScriptVariant[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [recommendedVariantId, setRecommendedVariantId] = useState<string | null>(
    null
  );
  const [culturalInsight, setCulturalInsight] = useState<CulturalInsight | null>(
    null
  );
  const [momentSignal, setMomentSignal] = useState<MomentSignalData>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Angle grouping + active angle
  const [angleGroups, setAngleGroups] = useState<AngleGroup[]>([]);
  const [activeAngleKey, setActiveAngleKey] = useState<string | null>(null);

  // Local behaviour controls (Stage 4: user shapes → engine responds)
  const [behaviourControls, setBehaviourControls] =
    useState<BehaviourControlsInput>(() => DEFAULT_BEHAVIOUR);

  useEffect(() => {
    if (!activeBrief) {
      setVariants([]);
      setActiveVariantId(null);
      setRecommendedVariantId(null);
      setCulturalInsight(null);
      setMomentSignal(null);
      setErrorMsg(null);
      setAngleGroups([]);
      setActiveAngleKey(null);
      setBehaviourControls(DEFAULT_BEHAVIOUR);
    }
  }, [activeBrief]);

  /**
   * Stage D.4 strict wiring:
   * - Only accept brief.momentId
   * - Do NOT fall back to brief.id (brief.id is a UI key and can drift)
   */
  function resolveMomentIdFromBriefStrict(brief: any): string | null {
    const mid =
      typeof brief?.momentId === "string" && brief.momentId.trim()
        ? brief.momentId.trim()
        : null;
    return mid ?? null;
  }

  async function handleGenerate() {
    if (!activeBrief) {
      setErrorMsg("No active brief selected. Go to Briefs and pick one first.");
      return;
    }

    const momentId = resolveMomentIdFromBriefStrict(activeBrief);

    // Governance guard: no qualified momentId, no scripts.
    if (!momentId) {
      setErrorMsg(
        "This brief isn’t linked to a qualified moment (missing momentId). Go to Trends → choose a Live qualified moment → create/activate a brief from it → then generate scripts."
      );
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setCulturalInsight(null);
    setMomentSignal(null);
    setAngleGroups([]);
    setActiveAngleKey(null);

    try {
      // Stage D.4: pass momentId explicitly AND stamp it onto brief for redundancy.
      const briefForRequest = { ...(activeBrief as any), momentId };

      const res = await fetch("/api/scripts/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          momentId,
          brief: briefForRequest,
          behaviour: behaviourControls ?? undefined,
        }),
      });

      // Stage D: may return HTTP 200 even on failure.
      const data = (await res.json().catch(() => null)) as
        | IntelligenceResponse
        | null;

      if (!data) {
        throw new Error("Unexpected empty response from the intelligence route.");
      }

      // Stage D: typed, UI-safe failures
      if (data.ok === false) {
        const code = String(data.error?.code || "ENGINE_ERROR");
        const msg = String(data.error?.message || "Script generation failed.");

        // Stage D.4 — moment governance / memory failure
        if (code === "MOMENT_NOT_QUALIFIED" || msg.includes("Moment is not qualified")) {
          const metaHint =
            data.error?.meta && Object.keys(data.error.meta).length > 0
              ? ` (meta: ${JSON.stringify(data.error.meta)})`
              : "";

          setVariants([]);
          setActiveVariantId(null);
          setRecommendedVariantId(null);
          setCulturalInsight(null);
          setMomentSignal(null);
          setAngleGroups([]);
          setActiveAngleKey(null);

          setErrorMsg(
            "Selected moment is not governed (no Moment Memory record). Go to Trends → refresh Live moments → select a qualified moment → re-create/activate the brief from that moment → then generate scripts again." +
              metaHint
          );

          return; // ✅ do not throw
        }

        // Other failures remain loud
        throw new Error(msg);
      }

      const rawVariants = Array.isArray(data.variants) ? data.variants : [];

      // Normalize into UI's ScriptVariant shape
      const normalized: ScriptVariant[] = rawVariants.map((v, index) => {
        const fallbackAngleName =
          typeof v.angleName === "string" && v.angleName.trim()
            ? v.angleName.trim()
            : `Angle ${index + 1}`;

        return {
          id: typeof v.id === "string" && v.id.trim() ? v.id : `variant-${index + 1}`,
          label:
            typeof v.label === "string" && v.label.trim()
              ? v.label
              : `Variant ${index + 1}`,
          body: typeof v.body === "string" ? v.body : "",
          angleName: fallbackAngleName,
          notes: typeof v.notes === "string" ? v.notes : undefined,
          score:
            typeof v.score === "number" && !Number.isNaN(v.score)
              ? Math.max(0, Math.min(10, v.score))
              : undefined,
        };
      });

      // Recommended variant = highest score
      let recommended: string | null = null;
      let bestScore = -1;

      for (const v of normalized) {
        if (typeof v.score === "number" && v.score > bestScore) {
          bestScore = v.score;
          recommended = v.id;
        }
      }

      const withRecommended = normalized.map((v) => ({
        ...v,
        isRecommended: v.id === recommended,
      }));

      setVariants(withRecommended);

      // Build angle groups from angleName
      const uniqueAnglesMap = new Map<string, AngleGroup>();

      withRecommended.forEach((v) => {
        const rawTitle = v.angleName || "Angle";
        const key = rawTitle;

        if (!uniqueAnglesMap.has(key)) {
          const letter = String.fromCharCode(
            "A".charCodeAt(0) + uniqueAnglesMap.size
          );
          uniqueAnglesMap.set(key, {
            key,
            title: rawTitle,
            label: `Angle ${letter}: ${rawTitle}`,
          });
        }
      });

      const groups = Array.from(uniqueAnglesMap.values());
      setAngleGroups(groups);

      // Choose initial active angle:
      // 1) angle of recommended variant (if any)
      // 2) otherwise first group
      let initialActiveAngleKey: string | null = null;

      if (recommended) {
        const rec = withRecommended.find((v) => v.id === recommended);
        if (rec?.angleName) initialActiveAngleKey = rec.angleName;
      }

      if (!initialActiveAngleKey && groups.length > 0) {
        initialActiveAngleKey = groups[0].key;
      }

      setActiveAngleKey(initialActiveAngleKey);

      // Initial active variant within that angle group
      if (withRecommended.length > 0) {
        const variantsInInitialAngle = initialActiveAngleKey
          ? withRecommended.filter((v) => v.angleName === initialActiveAngleKey)
          : withRecommended;

        const initialActiveId =
          (recommended &&
          variantsInInitialAngle.some((v) => v.id === recommended)
            ? recommended
            : variantsInInitialAngle[0]?.id) ?? withRecommended[0].id;

        setActiveVariantId(initialActiveId);
        setRecommendedVariantId(recommended);
      } else {
        setActiveVariantId(null);
        setRecommendedVariantId(null);
      }

      setCulturalInsight((data as IntelligenceOk).cultural ?? null);

      // Normalize momentSignal into UI shape
      const rawSignal = (data as IntelligenceOk).momentSignal ?? null;

      const normalizedSignal: MomentSignalData = rawSignal
        ? {
            coreMoment: rawSignal.coreMoment,
            culturalTension: rawSignal.culturalTension,
            stakes: rawSignal.stakes ?? rawSignal.whyThisMomentMatters ?? undefined,
            contentRole: rawSignal.contentRole ?? rawSignal.roleOfContent ?? undefined,
            watchouts: Array.isArray(rawSignal.watchouts)
              ? rawSignal.watchouts.join(" • ")
              : rawSignal.watchouts ?? undefined,
          }
        : null;

      setMomentSignal(normalizedSignal);
    } catch (err) {
      console.error(err);
      setVariants([]);
      setActiveVariantId(null);
      setRecommendedVariantId(null);
      setCulturalInsight(null);
      setMomentSignal(null);
      setAngleGroups([]);
      setActiveAngleKey(null);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating script variants. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Filter variants by active angle
  const visibleVariants =
    activeAngleKey && angleGroups.length > 0
      ? variants.filter((v) => (v.angleName || "") === activeAngleKey)
      : variants;

  const activeVariant =
    visibleVariants.find((v) => v.id === activeVariantId) || null;

  if (!activeBrief) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
            Script Variants
          </h1>
          <p className="text-sm text-neutral-400">
            Start by creating or selecting a brief. Once a brief is active,
            Appatize can generate all your script variants in one go.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/70 p-4">
          <p className="text-sm text-neutral-500">
            No brief selected yet. Go to{" "}
            <span className="font-medium text-neutral-200">Briefs</span> to
            create or activate one.
          </p>
        </div>
      </div>
    );
  }

  // Hyphen-clean display meta
  const titleText = cleanText((activeBrief as any).title || "Untitled brief");

  const rawPlatform =
    (activeBrief as any).platformOverride || (activeBrief as any).platformHint || null;
  const platformText = rawPlatform ? cleanText(String(rawPlatform)) : null;

  const objectiveText = (activeBrief as any).objective
    ? cleanText((activeBrief as any).objective)
    : null;

  return (
    <div className="space-y-4">
      {/* Header + generate */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
            Script Variants
          </h1>
          <p className="text-sm text-neutral-400">
            All variants are generated in one run from your active brief. Shape
            the behaviour, then fire the engine and flip through the angles and
            scores to pick the one that hits the moment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Generating scripts…" : "Generate scripts"}
          </button>
          <span className="hidden text-[11px] text-neutral-500 md:inline-flex">
            Behaviour → CIE → MSE → Variants
          </span>
        </div>
      </div>

      {/* Brief meta */}
      <div className="flex flex-wrap justify-between gap-2 rounded-xl border border-neutral-800 bg-neutral-950/80 p-3 text-xs text-neutral-400">
        <div className="space-y-0.5">
          <p className="line-clamp-1 font-medium text-neutral-200">{titleText}</p>

          {platformText && (
            <p className="line-clamp-1">
              Platform: <span className="text-neutral-200">{platformText}</span>
            </p>
          )}
        </div>

        {objectiveText && (
          <p className="max-w-xs text-right text-xs text-neutral-400 line-clamp-2">
            Objective: <span className="text-neutral-200">{objectiveText}</span>
          </p>
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="rounded-xl border border-red-700/70 bg-red-950/40 p-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Behaviour controls (Stage 4) */}
      <BehaviourControlsPanel
        value={behaviourControls}
        onChange={setBehaviourControls}
        isGenerating={isLoading}
      />

      {/* Cultural Snapshot v2 */}
      <CulturalSnapshot snapshot={culturalInsight} />

      {/* Moment Signal — strategy layer */}
      <MomentSignalPanel signal={momentSignal ?? undefined} />

      {/* Angle tabs */}
      {angleGroups.length > 1 && (
        <AngleTabs
          angles={angleGroups.map((g) => ({
            id: g.key,
            label: g.label,
          }))}
          activeAngleId={activeAngleKey}
          onChange={(id) => {
            setActiveAngleKey(id);
            const firstInAngle = variants.find((v) => (v.angleName || "") === id);
            if (firstInAngle) setActiveVariantId(firstInAngle.id);
          }}
        />
      )}

      {/* Variant tabs */}
      <VariantTabs
        variants={visibleVariants}
        activeVariantId={activeVariantId}
        onChange={setActiveVariantId}
        isDisabled={isLoading || visibleVariants.length === 0}
        recommendedVariantId={recommendedVariantId}
      />

      {/* Output */}
      <ScriptOutput variant={activeVariant as any} isLoading={isLoading} />
    </div>
  );
}
