// src/components/scripts/MomentHealthPanel.tsx
//
// Stage D.5 — Moment Health Panel (UI-safe)
//
// Rules:
// - Never render raw objects as React children
// - Handle null/empty states cleanly
// - Be resilient to schema changes (optional fields)

"use client";

import React from "react";

export type SourceHealth = {
  source: string;
  mode: "live" | "fallback" | "disabled";
  status: "ok" | "unavailable";
  count: number;
};

export type MomentHealth = {
  // Governed validity gate
  isValid?: boolean;

  // Optional stage fields (may exist depending on engine version)
  decision?: "ACT" | "WAIT" | "REFRESH" | string;
  confidenceTrajectory?: "RISING" | "FLAT" | "DECLINING" | "INSUFFICIENT" | string;

  // Evidence / explainability
  reason?: string;
  reasons?: string[]; // sometimes it's plural

  // Source health (this is what caused the crash when rendered as an object)
  sources?: SourceHealth[];

  // Generic bag for forward-compat (don’t display raw)
  meta?: Record<string, unknown>;
} | null;

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide";
  const cls =
    tone === "ok"
      ? `${base} bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30`
      : tone === "warn"
      ? `${base} bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30`
      : tone === "bad"
      ? `${base} bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30`
      : `${base} bg-neutral-500/10 text-neutral-200 ring-1 ring-neutral-500/20`;

  return <span className={cls}>{children}</span>;
}

export default function MomentHealthPanel({ momentHealth }: { momentHealth: MomentHealth }) {
  // Safe empty state
  if (!momentHealth) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-neutral-200">Moment Health</p>
          <Badge tone="neutral">No data</Badge>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Run generation to see governed validity, lifecycle status, and source reinforcement.
        </p>
      </div>
    );
  }

  const isValid = momentHealth.isValid !== false; // default true unless explicitly false
  const decision = typeof momentHealth.decision === "string" ? momentHealth.decision : null;
  const trajectory =
    typeof momentHealth.confidenceTrajectory === "string"
      ? momentHealth.confidenceTrajectory
      : null;

  const reasons =
    Array.isArray(momentHealth.reasons) && momentHealth.reasons.length > 0
      ? momentHealth.reasons.filter((r) => typeof r === "string" && r.trim())
      : typeof momentHealth.reason === "string" && momentHealth.reason.trim()
      ? [momentHealth.reason.trim()]
      : [];

  const sources: SourceHealth[] = Array.isArray(momentHealth.sources)
    ? momentHealth.sources.filter(
        (s): s is SourceHealth =>
          !!s &&
          typeof (s as any).source === "string" &&
          typeof (s as any).mode === "string" &&
          typeof (s as any).status === "string" &&
          typeof (s as any).count === "number"
      )
    : [];

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-neutral-200">Moment Health</p>
          {isValid ? <Badge tone="ok">VALID</Badge> : <Badge tone="bad">INVALID</Badge>}
          {decision ? (
            <Badge tone={decision === "ACT" ? "ok" : decision === "WAIT" ? "warn" : "neutral"}>
              {decision}
            </Badge>
          ) : null}
          {trajectory ? <Badge tone="neutral">{trajectory}</Badge> : null}
        </div>

        <div className="text-[11px] text-neutral-500">
          {sources.length > 0 ? `${sources.length} source entries` : "No source reinforcement data"}
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-950/40 p-2">
          <p className="text-[11px] font-semibold text-neutral-300">Why</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-neutral-400">
            {reasons.slice(0, 6).map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <p className="text-[11px] font-semibold text-neutral-300">Source reinforcement</p>

        {sources.length === 0 ? (
          <p className="mt-1 text-xs text-neutral-500">
            No per-source health available for this run.
          </p>
        ) : (
          <div className="mt-2 overflow-hidden rounded-lg border border-neutral-800">
            <div className="grid grid-cols-12 bg-neutral-950/60 px-2 py-1 text-[11px] font-semibold text-neutral-400">
              <div className="col-span-4">Source</div>
              <div className="col-span-3">Mode</div>
              <div className="col-span-3">Status</div>
              <div className="col-span-2 text-right">Count</div>
            </div>

            <div className="divide-y divide-neutral-800">
              {sources.map((s) => (
                <div
                  key={s.source}
                  className="grid grid-cols-12 px-2 py-1 text-xs text-neutral-300"
                >
                  <div className="col-span-4 font-medium text-neutral-200">{s.source}</div>
                  <div className="col-span-3 text-neutral-400">{s.mode}</div>
                  <div className="col-span-3">
                    <span
                      className={
                        s.status === "ok" ? "text-emerald-200" : "text-rose-200"
                      }
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="col-span-2 text-right text-neutral-400">{s.count}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
