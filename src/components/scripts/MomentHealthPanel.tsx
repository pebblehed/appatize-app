// src/components/scripts/MomentHealthPanel.tsx
"use client";

import React from "react";

export type ExplainBlock = {
  title?: string;
  label?: string;
  kind?: string; // "pass" | "fail" | "warn" | etc (engine-defined)
  message?: string;
  text?: string;
  bullets?: string[];
  details?: Record<string, unknown>;
};

type MomentHealthLike = {
  isValid?: boolean;
  lifecycleState?: string; // e.g. "stable" | "decaying" | "drift-risk" | "expired" | etc
  lastEvaluatedAt?: string; // ISO
  nextCheckpointAt?: string; // ISO (optional)
  sis?: number;
  ics?: number;
  thresholds?: {
    sisPass?: number;
    icsPass?: number;
  };
  explain?: ExplainBlock[]; // engine explainability blocks
  provenance?: {
    sources?: Array<{ source?: string; ts?: string; id?: string }>;
    sourceNames?: string[]; // fallback shape
    lastSeenAt?: string;
  };
};

// ✅ Exported for the import in src/app/scripts/page.tsx
export type MomentHealth = MomentHealthLike;

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function formatMaybeIso(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function scoreBadge(
  label: string,
  value: unknown,
  pass?: unknown,
  tone: "violet" | "neutral" | "amber" = "neutral"
) {
  const v = isNumber(value) ? value : null;
  const p = isNumber(pass) ? pass : null;

  const passText = v !== null && p !== null ? ` (pass ≥ ${p.toFixed(2)})` : "";

  const boxTone =
    tone === "violet"
      ? "border-violet-500/40 bg-violet-950/30 text-violet-100"
      : tone === "amber"
        ? "border-amber-500/40 bg-amber-950/25 text-amber-100"
        : "border-neutral-700 bg-neutral-950/40 text-neutral-200";

  return (
    <div className={`rounded-lg border px-3 py-2 ${boxTone}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">
        {v !== null ? v.toFixed(3) : "—"}
        <span className="text-[11px] font-normal opacity-70">{passText}</span>
      </div>
    </div>
  );
}

function kindToTone(kind?: string): { dot: string; box: string; text: string } {
  const k = (kind || "").toLowerCase();

  if (k.includes("fail") || k.includes("reject") || k.includes("invalid")) {
    return {
      dot: "bg-rose-400",
      box: "border-rose-500/40 bg-rose-950/25",
      text: "text-rose-100",
    };
  }

  if (k.includes("warn") || k.includes("drift") || k.includes("decay")) {
    return {
      dot: "bg-amber-400",
      box: "border-amber-500/40 bg-amber-950/20",
      text: "text-amber-100",
    };
  }

  if (k.includes("pass") || k.includes("valid") || k.includes("ok")) {
    return {
      dot: "bg-emerald-400",
      box: "border-emerald-500/35 bg-emerald-950/20",
      text: "text-emerald-100",
    };
  }

  return {
    dot: "bg-neutral-400",
    box: "border-neutral-800 bg-neutral-950/40",
    text: "text-neutral-200",
  };
}

function normalizeExplainBlocks(x: unknown): ExplainBlock[] {
  if (!x) return [];
  if (Array.isArray(x)) return x as ExplainBlock[];
  return [];
}

function normalizeSources(x: unknown): Array<{ source?: string; ts?: string; id?: string }> {
  if (!x) return [];
  if (Array.isArray(x)) return x as Array<{ source?: string; ts?: string; id?: string }>;
  return [];
}

export default function MomentHealthPanel({
  momentHealth,
  title = "Moment Health",
  compact = false,
}: {
  momentHealth: MomentHealth | null | undefined;
  title?: string;
  compact?: boolean;
}) {
  const mh = (momentHealth || {}) as MomentHealthLike;

  const isValid = typeof mh.isValid === "boolean" ? mh.isValid : undefined;
  const lifecycle = mh.lifecycleState || "—";

  const explainBlocks = normalizeExplainBlocks(mh.explain);
  const sources = normalizeSources(mh.provenance?.sources);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            {title}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                isValid === true
                  ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
                  : isValid === false
                    ? "border-rose-500/40 bg-rose-950/30 text-rose-100"
                    : "border-neutral-700 bg-neutral-950/40 text-neutral-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isValid === true
                    ? "bg-emerald-400"
                    : isValid === false
                      ? "bg-rose-400"
                      : "bg-neutral-400"
                }`}
              />
              {isValid === true ? "VALID" : isValid === false ? "INVALID" : "—"}
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-950/40 px-3 py-1 text-xs text-neutral-200">
              <span className="h-2 w-2 rounded-full bg-violet-400/80" />
              {lifecycle}
            </span>
          </div>

          {!compact && (
            <div className="mt-2 text-xs text-neutral-400">
              {mh.lastEvaluatedAt ? (
                <>
                  Last evaluated:{" "}
                  <span className="text-neutral-200">
                    {formatMaybeIso(mh.lastEvaluatedAt)}
                  </span>
                </>
              ) : (
                <span>No evaluation timestamp returned.</span>
              )}
              {mh.nextCheckpointAt ? (
                <>
                  {" "}
                  • Next checkpoint:{" "}
                  <span className="text-neutral-200">
                    {formatMaybeIso(mh.nextCheckpointAt)}
                  </span>
                </>
              ) : null}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {scoreBadge("SIS", mh.sis, mh.thresholds?.sisPass, "violet")}
          {scoreBadge("ICS", mh.ics, mh.thresholds?.icsPass, "neutral")}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {explainBlocks.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-400">
            No explainability blocks returned for this moment.
          </div>
        ) : (
          explainBlocks.map((b, idx) => {
            const tone = kindToTone(b.kind);
            const heading = b.title || b.label || "Explain";
            const body = b.message || b.text || "";

            return (
              <div
                key={`${heading}-${idx}`}
                className={`rounded-xl border p-4 ${tone.box} ${tone.text}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 rounded-full ${tone.dot}`} />
                  <div className="flex-1">
                    <div className="text-xs font-semibold">{heading}</div>
                    {body ? (
                      <div className="mt-1 text-sm leading-relaxed opacity-95">
                        {body}
                      </div>
                    ) : null}

                    {Array.isArray(b.bullets) && b.bullets.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm opacity-90">
                        {b.bullets.map((x, i) => (
                          <li key={`${idx}-b-${i}`}>{x}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!compact && (
        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            Provenance
          </div>

          <div className="mt-2 text-sm text-neutral-300">
            {sources.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sources.map((s, i) => (
                  <span
                    key={`${s.id || s.source || "source"}-${i}`}
                    className="rounded-full border border-neutral-700 bg-neutral-950/50 px-3 py-1 text-xs text-neutral-200"
                  >
                    {s.source || "source"}{" "}
                    <span className="opacity-60">
                      {s.ts ? `• ${formatMaybeIso(s.ts)}` : ""}
                    </span>
                  </span>
                ))}
              </div>
            ) : mh.provenance?.sourceNames && mh.provenance.sourceNames.length ? (
              <div className="flex flex-wrap gap-2">
                {mh.provenance.sourceNames.map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    className="rounded-full border border-neutral-700 bg-neutral-950/50 px-3 py-1 text-xs text-neutral-200"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-neutral-400">No provenance details returned.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
