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
import MomentHealthPanel, { type MomentHealth } from "@/components/scripts/MomentHealthPanel";

type CulturalInsight = {
  culturalContext?: string;
  momentInsight?: string;
  flowGuidance?: string;
  creativePrinciple?: string;
};

type AngleGroup = {
  key: string;
  title: string;
  label: string;
};

type MomentSignalData = {
  coreMoment?: string;
  culturalTension?: string;
  stakes?: string;
  contentRole?: string;
  watchouts?: string;
} | null;

// Local default behaviour profile
const DEFAULT_BEHAVIOUR: BehaviourControlsInput = {
  energy: "steady",
  tone: "clean",
  rhythm: "balanced",
  platform: "ugc-ad",
};

// --- Stage D response types from /api/scripts/intelligence ---
type IntelligenceFail = {
  ok: false;
  error: {
    code: string;
    message: string;
    meta?: Record<string, unknown>;
  };
  momentHealth?: MomentHealth | null;
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

    hook?: string;
    mainBody?: string;
    cta?: string;
    outro?: string;
  }>;
  cultural?: CulturalInsight | null;
  momentSignal?: any;
  momentHealth?: MomentHealth | null;
  result?: any;
};

type IntelligenceResponse = IntelligenceOk | IntelligenceFail;

function isStaleMomentFailure(code: string, msg: string) {
  const c = (code || "").toUpperCase();
  const m = (msg || "").toLowerCase();

  // Treat these as the same governed class:
  // “moment was valid but has lost live reinforcement / expired / drifted”
  return (
    c.includes("MOMENT_STALE") ||
    c.includes("MOMENT_EXPIRED") ||
    c.includes("MOMENT_NO_LONGER_VALID") ||
    c.includes("INSUFFICIENT_SIGNALS") ||
    m.includes("no longer valid") ||
    m.includes("insufficient matching live signals") ||
    m.includes("refresh live moments")
  );
}

export default function ScriptsPage() {
  const { activeBrief } = useBriefContext();

  const [variants, setVariants] = useState<ScriptVariant[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [recommendedVariantId, setRecommendedVariantId] = useState<string | null>(null);

  const [culturalInsight, setCulturalInsight] = useState<CulturalInsight | null>(null);
  const [momentSignal, setMomentSignal] = useState<MomentSignalData>(null);

  // Stage D.5: Moment health
  const [momentHealth, setMomentHealth] = useState<MomentHealth | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [angleGroups, setAngleGroups] = useState<AngleGroup[]>([]);
  const [activeAngleKey, setActiveAngleKey] = useState<string | null>(null);

  const [behaviourControls, setBehaviourControls] =
    useState<BehaviourControlsInput>(() => DEFAULT_BEHAVIOUR);

  useEffect(() => {
    if (!activeBrief) {
      setVariants([]);
      setActiveVariantId(null);
      setRecommendedVariantId(null);
      setCulturalInsight(null);
      setMomentSignal(null);
      setMomentHealth(null);
      setErrorMsg(null);
      setAngleGroups([]);
      setActiveAngleKey(null);
      setBehaviourControls(DEFAULT_BEHAVIOUR);
    } else {
      // New brief activated → clear previous run’s health/explain to avoid UI bleed
      setMomentHealth(null);
      setErrorMsg(null);
    }
  }, [activeBrief]);

  function resolveMomentIdFromBriefStrict(brief: any): string | null {
    const mid =
      typeof brief?.momentId === "string" && brief.momentId.trim()
        ? brief.momentId.trim()
        : null;
    return mid ?? null;
  }

  function clearRunState() {
    setVariants([]);
    setActiveVariantId(null);
    setRecommendedVariantId(null);
    setCulturalInsight(null);
    setMomentSignal(null);
    setAngleGroups([]);
    setActiveAngleKey(null);
  }

  async function handleGenerate() {
    if (!activeBrief) {
      setErrorMsg("No active brief selected. Go to Briefs and pick one first.");
      return;
    }

    const momentId = resolveMomentIdFromBriefStrict(activeBrief);

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
    setMomentHealth(null);
    setAngleGroups([]);
    setActiveAngleKey(null);

    try {
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

      const data = (await res.json().catch(() => null)) as IntelligenceResponse | null;

      if (!data) {
        throw new Error("Unexpected empty response from the intelligence route.");
      }

      // Always capture momentHealth if present (even on failure)
      if (typeof (data as any).momentHealth !== "undefined") {
        setMomentHealth((data as any).momentHealth ?? null);
      }

      // ----- Failure path (governed, UI-safe) -----
      if (data.ok === false) {
        const code = String(data.error?.code || "ENGINE_ERROR");
        const msg = String(data.error?.message || "Script generation failed.");

        // Helpful log, but don’t crash the UX
        console.log("[/api/scripts/intelligence] full response:", data);

        // D.4 — moment governance / memory failure
        if (code === "MOMENT_NOT_QUALIFIED" || msg.includes("Moment is not qualified")) {
          const metaHint =
            data.error?.meta && Object.keys(data.error.meta).length > 0
              ? ` (meta: ${JSON.stringify(data.error.meta)})`
              : "";

          clearRunState();

          setErrorMsg(
            "Selected moment is not governed (no Moment Memory record). Go to Trends → refresh Live moments → select a qualified moment → re-create/activate the brief from that moment → then generate scripts again." +
              metaHint
          );
          return;
        }

        // D.5 — moment is governed but no longer sufficiently reinforced
        if (isStaleMomentFailure(code, msg)) {
          clearRunState();
          setErrorMsg(
            "This moment has drifted / weakened and is no longer valid for generation (insufficient live reinforcement). Go to Trends → refresh Live moments → pick a currently VALID moment → create/activate a new brief from it → then generate scripts."
          );
          return;
        }

        // Other failures: show message cleanly (no thrown stack theatrics)
        clearRunState();
        setErrorMsg(msg);
        return;
      }

      // ----- Success path -----
      const okData = data as IntelligenceOk;
      const rawVariants = Array.isArray(okData.variants) ? okData.variants : [];

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
          isRecommended: false,
          // NOTE: we intentionally don’t “extend” ScriptVariant here.
          // ScriptOutput already supports structured fields via its own internal typing when passed `any` if needed.
        };
      });

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

      const uniqueAnglesMap = new Map<string, AngleGroup>();

      withRecommended.forEach((v) => {
        const rawTitle = v.angleName || "Angle";
        const key = rawTitle;

        if (!uniqueAnglesMap.has(key)) {
          const letter = String.fromCharCode("A".charCodeAt(0) + uniqueAnglesMap.size);
          uniqueAnglesMap.set(key, {
            key,
            title: rawTitle,
            label: `Angle ${letter}: ${rawTitle}`,
          });
        }
      });

      const groups = Array.from(uniqueAnglesMap.values());
      setAngleGroups(groups);

      let initialActiveAngleKey: string | null = null;

      if (recommended) {
        const rec = withRecommended.find((v) => v.id === recommended);
        if (rec?.angleName) initialActiveAngleKey = rec.angleName;
      }

      if (!initialActiveAngleKey && groups.length > 0) {
        initialActiveAngleKey = groups[0].key;
      }

      setActiveAngleKey(initialActiveAngleKey);

      if (withRecommended.length > 0) {
        const variantsInInitialAngle = initialActiveAngleKey
          ? withRecommended.filter((v) => v.angleName === initialActiveAngleKey)
          : withRecommended;

        const initialActiveId =
          (recommended && variantsInInitialAngle.some((v) => v.id === recommended)
            ? recommended
            : variantsInInitialAngle[0]?.id) ?? withRecommended[0].id;

        setActiveVariantId(initialActiveId);
        setRecommendedVariantId(recommended);
      } else {
        setActiveVariantId(null);
        setRecommendedVariantId(null);
      }

      setCulturalInsight(okData.cultural ?? null);

      const rawSignal = okData.momentSignal ?? null;

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

      if (typeof okData.momentHealth !== "undefined") {
        setMomentHealth(okData.momentHealth ?? null);
      }
    } catch (err) {
      console.error(err);
      clearRunState();
      setMomentHealth(null);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating script variants. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const visibleVariants =
    activeAngleKey && angleGroups.length > 0
      ? variants.filter((v) => (v.angleName || "") === activeAngleKey)
      : variants;

  const activeVariant = visibleVariants.find((v) => v.id === activeVariantId) || null;

  const isMomentInvalid = momentHealth?.isValid === false;

  if (!activeBrief) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
            Script Variants
          </h1>
          <p className="text-sm text-neutral-400">
            Start by creating or selecting a brief. Once a brief is active, Appatize can
            generate all your script variants in one go.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/70 p-4">
          <p className="text-sm text-neutral-500">
            No brief selected yet. Go to <span className="font-medium text-neutral-200">Briefs</span>{" "}
            to create or activate one.
          </p>
        </div>
      </div>
    );
  }

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
            All variants are generated in one run from your active brief. Shape the behaviour,
            then fire the engine and flip through the angles and scores to pick the one that hits
            the moment.
          </p>
        </div>

        <div className="flex flex-col items-start gap-1 md:items-end">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading || isMomentInvalid}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              title={
                isMomentInvalid
                  ? "This moment is currently INVALID according to the engine. Review Moment Health for why."
                  : undefined
              }
            >
              {isLoading ? "Generating scripts…" : "Generate scripts"}
            </button>
            <span className="hidden text-[11px] text-neutral-500 md:inline-flex">
              Behaviour → CIE → MSE → Variants
            </span>
          </div>

          {isMomentInvalid && (
            <p className="text-[11px] text-rose-200">
              Generation disabled: this moment is marked{" "}
              <span className="font-semibold">INVALID</span> by the engine. Review Moment Health below.
            </p>
          )}
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

      {/* Stage D.5 Moment Health — explainability + lifecycle */}
      <MomentHealthPanel momentHealth={momentHealth} />

      {/* Behaviour controls */}
      <BehaviourControlsPanel
        value={behaviourControls}
        onChange={setBehaviourControls}
        isGenerating={isLoading}
      />

      {/* Cultural Snapshot */}
      <CulturalSnapshot snapshot={culturalInsight} />

      {/* Moment Signal */}
      <MomentSignalPanel signal={momentSignal ?? undefined} />

      {/* Angle tabs */}
      {angleGroups.length > 1 && (
        <AngleTabs
          angles={angleGroups.map((g) => ({ id: g.key, label: g.label }))}
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
      <ScriptOutput variant={activeVariant} isLoading={isLoading} />
    </div>
  );
}
