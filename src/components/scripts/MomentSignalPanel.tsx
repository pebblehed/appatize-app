// src/components/scripts/MomentSignalPanel.tsx
"use client";

import React from "react";
import clsx from "clsx";

type MomentSignalLike = {
  coreMoment?: string;
  culturalTension?: string;
  stakes?: string;
  contentRole?: string;
  // Support both array (from API) and string (any older shape)
  watchouts?: string | string[];
  [key: string]: any;
};

export type MomentSignalProps = {
  isLoading?: boolean;
  error?: string | null;
  signal?: MomentSignalLike | null;
};

export default function MomentSignalPanel({
  isLoading = false,
  error = null,
  signal,
}: MomentSignalProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="mt-3 rounded-xl border border-purple-800/60 bg-purple-950/20 p-3">
        <div className="flex items-center gap-2 text-xs text-purple-100">
          <span className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
          <span>Scanning the moment and cultural signals…</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mt-3 rounded-xl border border-red-700/70 bg-red-950/40 p-3">
        <p className="text-xs text-red-100">
          {error || "Something went wrong reading the moment signal."}
        </p>
      </div>
    );
  }

  // Empty state – nothing from the engine yet
  if (!signal) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-3">
        <p className="text-xs text-neutral-400">
          Moment signal will show up here once the engine has enough context
          from your brief and behaviour controls.
        </p>
      </div>
    );
  }

  const { coreMoment, culturalTension, stakes, contentRole } = signal;

  const rawWatchouts = signal.watchouts;
  const normalizedWatchouts = Array.isArray(rawWatchouts)
    ? rawWatchouts.join("\n• ")
    : rawWatchouts;

  const hasAny =
    coreMoment || culturalTension || stakes || contentRole || normalizedWatchouts;

  if (!hasAny) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-3">
        <p className="text-xs text-neutral-400">
          No moment signal extracted for this brief yet.
        </p>
      </div>
    );
  }

  const gridItemClass = "space-y-1";

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-purple-800/60 bg-neutral-950/90 p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-300">
            Moment Signal
          </p>
          <p className="text-[11px] text-neutral-400">
            A quick read on the cultural moment your scripts are stepping into.
          </p>
        </div>
        <span className="h-1.5 w-16 rounded-full bg-purple-500/70 blur-[2px]" />
      </div>

      {/* Body grid */}
      <div className="grid gap-3 text-xs text-neutral-200 md:grid-cols-2">
        {coreMoment && (
          <div className={gridItemClass}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Core moment
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">
              {coreMoment}
            </p>
          </div>
        )}

        {culturalTension && (
          <div className={gridItemClass}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Cultural tension
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">
              {culturalTension}
            </p>
          </div>
        )}

        {stakes && (
          <div className={clsx(gridItemClass, "md:col-span-2")}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Why this moment matters
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">
              {stakes}
            </p>
          </div>
        )}

        {contentRole && (
          <div className={gridItemClass}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Role of your content
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">
              {contentRole}
            </p>
          </div>
        )}

        {normalizedWatchouts && (
          <div className={gridItemClass}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Watch-outs
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">
              {/* if we joined with bullets, add a leading bullet in UI */}
              {Array.isArray(rawWatchouts)
                ? `• ${normalizedWatchouts}`
                : normalizedWatchouts}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
