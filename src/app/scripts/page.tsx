// app/scripts/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useBriefContext } from "@/context/BriefContext";
import VariantTabs, {
  ScriptVariant,
} from "@/components/variant/VariantsTabs"; // 👈 folder name fixed
import ScriptOutput from "@/app/scripts/ScriptOutput"; // 👈 correct path for your file

export default function ScriptsPage() {
  const { activeBrief } = useBriefContext();

  const [variants, setVariants] = useState<ScriptVariant[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 🔁 Stage C: generate ALL variants once from the active brief
  useEffect(() => {
    if (!activeBrief) {
      setVariants([]);
      setActiveVariantId(null);
      setErrorMsg(null);
      return;
    }

    let cancelled = false;

    async function generateVariants() {
      setIsLoading(true);
      setErrorMsg(null);

      try {
        // ✅ This matches app/api/scripts/generate/route.ts → /api/scripts/generate
        const res = await fetch("/api/scripts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: activeBrief }),
        });

        if (!res.ok) {
          throw new Error(`Failed to generate variants (${res.status})`);
        }

        const data = (await res.json()) as { variants: ScriptVariant[] };

        if (cancelled) return;

        const normalized =
          (data.variants || []).map((v, index) => ({
            id: v.id ?? `variant-${index + 1}`,
            label: v.label ?? `Variant ${index + 1}`,
            body: v.body ?? "",
            angleName: v.angleName,
            notes: v.notes,
          })) ?? [];

        setVariants(normalized);

        if (normalized.length > 0) {
          setActiveVariantId(normalized[0].id);
        } else {
          setActiveVariantId(null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setVariants([]);
          setActiveVariantId(null);
          setErrorMsg(
            "Something went wrong while generating script variants. Please try again."
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

  // 🔹 Guard: no active brief yet
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">
          Script Variants
        </h1>
        <p className="text-sm text-neutral-400">
          All variants are generated in one run from your active brief. Flip
          through them with the tabs and choose the one that hits the moment.
        </p>
      </div>

      {/* Brief meta */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3 text-xs text-neutral-400 flex flex-wrap justify-between gap-2">
        <div className="space-y-0.5">
          <p className="font-medium text-neutral-200 line-clamp-1">
            {activeBrief.title ?? "Untitled brief"}
          </p>
          {activeBrief.platform && (
            <p className="line-clamp-1">
              Platform:{" "}
              <span className="text-neutral-200">{activeBrief.platform}</span>
            </p>
          )}
        </div>
        {activeBrief.objective && (
          <p className="max-w-xs text-right line-clamp-2">
            Objective:{" "}
            <span className="text-neutral-200">
              {activeBrief.objective}
            </span>
          </p>
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="rounded-xl border border-red-700/70 bg-red-950/40 p-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Variant tabs */}
      <VariantTabs
        variants={variants}
        activeVariantId={activeVariantId}
        onChange={setActiveVariantId}
        isDisabled={isLoading || variants.length === 0}
      />

      {/* Output */}
      <ScriptOutput variant={activeVariant} isLoading={isLoading} />
    </div>
  );
}
