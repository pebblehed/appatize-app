// src/app/scripts/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useBriefContext } from "@/context/BriefContext";
import VariantTabs, {
  ScriptVariant,
} from "@/components/variant/VariantsTabs";
import ScriptOutput from "./ScriptOutput";
import { cleanText } from "@/engine/cleanText";

type CulturalInsight = {
  culturalContext?: string;
  momentInsight?: string;
  flowGuidance?: string;
  creativePrinciple?: string;
};

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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!activeBrief) {
      setVariants([]);
      setActiveVariantId(null);
      setRecommendedVariantId(null);
      setCulturalInsight(null);
      setErrorMsg(null);
      return;
    }

    let cancelled = false;

    async function generateVariants() {
      setIsLoading(true);
      setErrorMsg(null);
      setCulturalInsight(null);

      try {
        const res = await fetch("/api/scripts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: activeBrief }),
        });

        if (!res.ok) {
          let apiMessage: string | undefined;
          try {
            const errJson = await res.json();
            apiMessage =
              typeof errJson?.error === "string" ? errJson.error : undefined;
          } catch {}

          if (res.status === 429) {
            throw new Error(
              apiMessage ??
                "Rate limit reached. Please wait a few seconds and try again."
            );
          }

          throw new Error(
            apiMessage ??
              `Failed to generate variants (status ${res.status}).`
          );
        }

        const data = (await res.json()) as {
          variants: ScriptVariant[];
          cultural?: CulturalInsight | null;
        };

        if (cancelled) return;

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

        if (withRecommended.length > 0) {
          const initialActiveId = recommended ?? withRecommended[0].id;
          setActiveVariantId(initialActiveId);
          setRecommendedVariantId(recommended);
        } else {
          setActiveVariantId(null);
          setRecommendedVariantId(null);
        }

        setCulturalInsight(data.cultural ?? null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setVariants([]);
          setActiveVariantId(null);
          setRecommendedVariantId(null);
          setCulturalInsight(null);
          setErrorMsg(
            err instanceof Error
              ? err.message
              : "Something went wrong while generating script variants. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    generateVariants();

    return () => {
      cancelled = true;
    };
  }, [activeBrief]);

  const activeVariant =
    variants.find((v) => v.id === activeVariantId) || null;

  if (!activeBrief) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
            Script Variants
          </h1>
          <p className="text-sm text-neutral-400">
            Start by creating or selecting a brief. Once a brief is active,
            Appatize will generate all your script variants in one go.
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
    activeBrief.platformOverride ||
    activeBrief.platformHint ||
    null;
  const platformText = rawPlatform
    ? cleanText(String(rawPlatform))
    : null;

  const objectiveText = activeBrief.objective
    ? cleanText(activeBrief.objective)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
          Script Variants
        </h1>
        <p className="text-sm text-neutral-400">
          All variants are generated in one run from your active brief. Flip
          through them with the tabs, review the angles and scores, and pick
          the one that hits the moment.
        </p>
      </div>

      {/* Brief meta */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3 text-xs text-neutral-400 flex flex-wrap justify-between gap-2">
        <div className="space-y-0.5">
          <p className="font-medium text-neutral-200 line-clamp-1">
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
          <p className="max-w-xs text-right line-clamp-2">
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

      {/* Cultural Intelligence Snapshot */}
      {culturalInsight && !errorMsg && (
        <div className="rounded-xl border border-purple-700/60 bg-purple-950/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-200">
              Cultural Intelligence Snapshot
            </p>
            <span className="h-1.5 w-16 rounded-full bg-purple-500/60 blur-[2px]" />
          </div>

          {culturalInsight.culturalContext && (
            <p className="text-xs text-neutral-200">
              <span className="font-semibold text-neutral-100">
                Cultural context:
              </span>{" "}
              {culturalInsight.culturalContext}
            </p>
          )}

          {culturalInsight.momentInsight && (
            <p className="text-xs text-neutral-200">
              <span className="font-semibold text-neutral-100">
                Audience / moment:
              </span>{" "}
              {culturalInsight.momentInsight}
            </p>
          )}

          {culturalInsight.flowGuidance && (
            <p className="text-xs text-neutral-200">
              <span className="font-semibold text-neutral-100">
                Flow guidance:
              </span>{" "}
              {culturalInsight.flowGuidance}
            </p>
          )}

          {culturalInsight.creativePrinciple && (
            <p className="text-xs text-neutral-200">
              <span className="font-semibold text-neutral-100">
                Creative principle:
              </span>{" "}
              {culturalInsight.creativePrinciple}
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      <VariantTabs
        variants={variants}
        activeVariantId={activeVariantId}
        onChange={setActiveVariantId}
        isDisabled={isLoading || variants.length === 0}
        recommendedVariantId={recommendedVariantId}
      />

      {/* Output */}
      <ScriptOutput variant={activeVariant} isLoading={isLoading} />
    </div>
  );
}
