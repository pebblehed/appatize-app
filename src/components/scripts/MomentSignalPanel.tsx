"use client";

import React from "react";
import clsx from "clsx";

export type MomentSignalProps = {
  isLoading?: boolean;
  error?: string | null;
  signal?: {
    coreMoment?: string;
    culturalTension?: string;
    stakes?: string;
    contentRole?: string;
    watchouts?: string;
  } | null;
};

export default function MomentSignalPanel({
  isLoading = false,
  error = null,
  signal,
}: MomentSignalProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-xl border border-purple-800/60 bg-purple-950/20 p-3 mt-3">
        <div className="flex items-center gap-2 text-xs text-purple-100">
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
          <span>Scanning the moment and cultural signals…</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-red-700/70 bg-red-950/40 p-3 mt-3">
        <p className="text-xs text-red-100">
          {error || "Something went wrong reading the moment signal."}
        </p>
      </div>
    );
  }

  // Empty state – nothing from the engine yet
  if (!signal) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-3 mt-3">
        <p className="text-xs text-neutral-400">
          Moment signal will show up here once the engine has enough context
          from your brief and behaviour controls.
        </p>
      </div>
    );
  }

  const {
    coreMoment,
    culturalTension,
    stakes,
    contentRole,
    watchouts,
  } = signal;

  const hasAny =
    coreMoment || culturalTension || stakes || contentRole || watchouts;

  if (!hasAny) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-3 mt-3">
        <p className="text-xs text-neutral-400">
          No moment signal extracted for this brief yet.
        </p>
      </div>
    );
  }

  const gridItemClass = "space-y-1";

  return (
    <div className="mt-3 rounded-xl border border-purple-800/60 bg-neutral-950/90 p-3 space-y-3">
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
            <p className="leading-relaxed whitespace-pre-wrap">
              {coreMoment}
            </p>
          </div>
        )}

        {culturalTension && (
          <div className={gridItemClass}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Cultural tension
            </p>
            <p className="leading-relaxed whitespace-pre-wrap">
              {culturalTension}
            </p>
          </div>
        )}

        {stakes && (
          <div className={clsx(gridItemClass, "md:col-span-2")}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Why this moment matters
            </p>
            <p className="leading-relaxed whitespace-pre-wrap">
              {stakes}
            </p>
          </div>
        )}

        {contentRole && (
          <div className={gridItemClass}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Role of your content
            </p>
            <p className="leading-relaxed whitespace-pre-wrap">
              {contentRole}
            </p>
          </div>
        )}

        {watchouts && (
          <div className={gridItemClass}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Watch-outs
            </p>
            <p className="leading-relaxed whitespace-pre-wrap">
              {watchouts}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
