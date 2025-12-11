// src/app/scripts/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useBriefContext } from "@/context/BriefContext";
import VariantTabs, {
  ScriptVariant,
} from "@/components/variant/VariantsTabs";
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
const DEFAULT_BEHAVIOUR = {
  energy: "steady" as any,
  tone: "clean" as any,
  rhythm: "balanced" as any,
  platform: "ugc-ad" as any,
} as BehaviourControlsInput;

export default function ScriptsPage() {
  const { activeBrief } = useBriefContext();

  const [variants, setVariants] = useState<ScriptVariant[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [recommendedVariantId, setRecommendedVariantId] = useState<
    string | null
  >(null);
  const [culturalInsight, setCulturalInsight] = useState<
    CulturalInsight | null
  >(null);
  const [momentSignal, setMomentSignal] = useState<MomentSignalData>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Angle grouping + active angle
  const [angleGroups, setAngleGroups] = useState<AngleGroup[]>([]);
  const [activeAngleKey, setActiveAngleKey] = useState<string | null>(null);

  // Local behaviour controls (Stage 4: user shapes → engine responds)
  const [behaviourControls, setBehaviourControls] =
    useState<BehaviourControlsInput>(() => DEFAULT_BEHAVIOUR);

  // If there is NO active brief, clear everything. If there *is* a brief,
  // we keep whatever behaviourControls the user has set (no auto-reset).
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

  async function handleGenerate() {
    if (!activeBrief) {
      setErrorMsg("No active brief selected. Go to Briefs and pick one first.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setCulturalInsight(null);
    setMomentSignal(null);
    setAngleGroups([]);
    setActiveAngleKey(null);

    try {
      const res = await fetch("/api/scripts/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: activeBrief,
          behaviour: behaviourControls ?? undefined,
        }),
      });

      if (!res.ok) {
        let apiMessage: string | undefined;
        try {
          const errJson = await res.json();
          apiMessage =
            typeof errJson?.error === "string" ? errJson.error : undefined;
        } catch {
          // ignore JSON parse errors; fall back to generic
        }

        if (res.status === 429) {
          throw new Error(
            apiMessage ??
              "Rate limit reached. Please wait a few seconds and try again."
          );
        }

        throw new Error(
          apiMessage ?? `Failed to generate variants (status ${res.status}).`
        );
      }

      const data = (await res.json()) as {
        variants: ScriptVariant[];
        cultural?: CulturalInsight | null;
        // raw momentSignal can have several field names; we normalise it below
        momentSignal?: any;
      };

      const normalized =
        (data.variants || []).map((v, index) => ({
          id: v.id ?? `variant-${index + 1}`,
          label: v.label ?? `Variant ${index + 1}`,
          body: v.body ?? "",
          angleName: v.angleName,
          notes: v.notes,
          score:
            typeof v.score === "number" && !Number.isNaN(v.score)
              ? Math.max(0, Math.min(10, v.score))
              : undefined,
        })) ?? [];

      // Determine recommended variant (highest score)
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

      withRecommended.forEach((v, idx) => {
        const rawTitle = v.angleName || `Angle ${idx + 1}`;
        const key = rawTitle; // use the angle title as grouping key

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
      // 2) otherwise first angle group
      let initialActiveAngleKey: string | null = null;

      if (recommended) {
        const rec = withRecommended.find((v) => v.id === recommended);
        if (rec?.angleName) {
          initialActiveAngleKey = rec.angleName;
        }
      }

      if (!initialActiveAngleKey && groups.length > 0) {
        initialActiveAngleKey = groups[0].key;
      }

      setActiveAngleKey(initialActiveAngleKey);

      // Set active / recommended variant IDs
      if (withRecommended.length > 0) {
        const initialActiveId = recommended ?? withRecommended[0].id;
        setActiveVariantId(initialActiveId);
        setRecommendedVariantId(recommended);
      } else {
        setActiveVariantId(null);
        setRecommendedVariantId(null);
      }

      setCulturalInsight(data.cultural ?? null);

      // 🔧 Normalise momentSignal from API → UI shape
      const rawSignal = data.momentSignal ?? null;

      const normalizedSignal: MomentSignalData = rawSignal
        ? {
            coreMoment: rawSignal.coreMoment,
            culturalTension: rawSignal.culturalTension,
            // API may send whyThisMomentMatters or stakes
            stakes:
              rawSignal.stakes ?? rawSignal.whyThisMomentMatters ?? undefined,
            // API may send roleOfContent or contentRole
            contentRole:
              rawSignal.contentRole ?? rawSignal.roleOfContent ?? undefined,
            // API may send watchouts as array or string
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
  const titleText = cleanText(activeBrief.title || "Untitled brief");

  const rawPlatform =
    activeBrief.platformOverride || activeBrief.platformHint || null;
  const platformText = rawPlatform ? cleanText(String(rawPlatform)) : null;

  const objectiveText = activeBrief.objective
    ? cleanText(activeBrief.objective)
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
          <p className="line-clamp-1 font-medium text-neutral-200">
            {titleText}
          </p>

          {platformText && (
            <p className="line-clamp-1">
              Platform:{" "}
              <span className="text-neutral-200">{platformText}</span>
            </p>
          )}
        </div>

        {objectiveText && (
          <p className="max-w-xs text-right text-xs text-neutral-400 line-clamp-2">
            Objective:{" "}
            <span className="text-neutral-200">{objectiveText}</span>
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

      {/* Angle tabs (Angle A/B/C with titles) */}
      {angleGroups.length > 1 && (
        <AngleTabs
          angles={angleGroups.map((g) => ({
            id: g.key,
            label: g.label,
          }))}
          activeAngleId={activeAngleKey}
          onChange={(id) => {
            setActiveAngleKey(id);
            // When switching angle, reset active variant to the first in that angle group (if any)
            const firstInAngle = variants.find(
              (v) => (v.angleName || "") === id
            );
            if (firstInAngle) {
              setActiveVariantId(firstInAngle.id);
            }
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
