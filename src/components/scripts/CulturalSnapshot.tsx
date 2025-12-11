// src/components/scripts/CulturalSnapshot.tsx
"use client";

import React from "react";
import type { CulturalSnapshotPayload } from "@/lib/intelligence/types";

type CulturalSnapshotProps = {
  snapshot: CulturalSnapshotPayload | null;
};

export default function CulturalSnapshot({ snapshot }: CulturalSnapshotProps) {
  if (!snapshot) return null;

  const {
    // v1-style fields
    culturalContext,
    momentInsight,
    flowGuidance,
    creativePrinciple,

    // v2-style fields from the engine / route
    culturalDynamics,
    audienceMood,
    platformStylePulse,
    creativeLevers,

    // extra v2 fields we want to surface in a backwards-compatible way
    contextInCulture,
    audienceMoodSensitivity,
    audienceMomentInsight,
  } = snapshot as CulturalSnapshotPayload & {
    contextInCulture?: string;
    audienceMoodSensitivity?: string;
    audienceMomentInsight?: string;
  };

  // Backwards-compatible resolution: prefer v1 keys if present,
  // otherwise fall back to the newer v2 names.
  const resolvedContext =
    culturalContext || contextInCulture || undefined;

  const resolvedAudienceMood =
    audienceMood || audienceMoodSensitivity || undefined;

  const resolvedMomentInsight =
    momentInsight || audienceMomentInsight || undefined;

  // If somehow everything is empty, don’t render noise
  const hasAny =
    resolvedContext ||
    resolvedMomentInsight ||
    flowGuidance ||
    creativePrinciple ||
    culturalDynamics ||
    resolvedAudienceMood ||
    platformStylePulse ||
    creativeLevers;

  if (!hasAny) return null;

  return (
    <section className="space-y-3 rounded-xl border border-purple-700/60 bg-purple-950/15 p-3.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-purple-200">
            Cultural Intelligence Snapshot
          </p>
          <p className="text-[11px] text-neutral-300/80">
            A fast read on the cultural moment before we write a single word.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/50 bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-100">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            CIE v2
          </span>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-purple-500/40 via-purple-400/10 to-transparent" />

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Column 1 */}
        <div className="space-y-2">
          {culturalDynamics && (
            <Block label="Cultural dynamics" body={culturalDynamics} />
          )}

          {resolvedContext && (
            <Block
              label="Context in the culture"
              body={resolvedContext}
            />
          )}

          {resolvedAudienceMood && (
            <Block
              label="Audience mood & sensitivity"
              body={resolvedAudienceMood}
            />
          )}

          {resolvedMomentInsight && (
            <Block
              label="Audience / moment insight"
              body={resolvedMomentInsight}
            />
          )}
        </div>

        {/* Column 2 */}
        <div className="space-y-2">
          {platformStylePulse && (
            <Block
              label="Platform style pulse"
              body={platformStylePulse}
            />
          )}

          {creativeLevers && (
            <Block
              label="Creative levers"
              body={creativeLevers}
              highlight
            />
          )}

          {flowGuidance && (
            <Block
              label="Flow guidance"
              body={flowGuidance}
            />
          )}

          {creativePrinciple && (
            <Block
              label="Creative principle"
              body={creativePrinciple}
            />
          )}
        </div>
      </div>
    </section>
  );
}

type BlockProps = {
  label: string;
  body: string;
  highlight?: boolean;
};

function Block({ label, body, highlight = false }: BlockProps) {
  return (
    <div
      className={
        highlight
          ? "space-y-1.5 rounded-lg border border-purple-500/40 bg-purple-500/5 p-2.5"
          : "space-y-1.5 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2.5"
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-300">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-100">
        {body}
      </p>
    </div>
  );
}
