// src/app/briefs/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useBriefContext, type Brief } from "@/context/BriefContext";

export default function BriefsPage() {
  const router = useRouter();
  const { briefs, activeBrief, setActiveBrief } = useBriefContext();

  const hasBriefs = briefs && briefs.length > 0;

  // Set this brief as active and move to /scripts
  const generateScriptFromBrief = (brief: Brief) => {
    setActiveBrief(brief);
    router.push("/scripts");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Briefs</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Angle-powered creative briefs generated from trends. Pick one to turn
          into platform-native scripts.
        </p>
      </div>

      {/* Empty state */}
      {!hasBriefs && (
        <div className="rounded-2xl border border-shell-border bg-shell-panel/90 p-6 text-sm text-neutral-400">
          You don&apos;t have any briefs yet. Start from the{" "}
          <span className="font-semibold text-neutral-200">Trends</span> view,
          choose a trend, and either turn it into a brief or pick an angle.
        </div>
      )}

      {/* Brief list */}
      {hasBriefs && (
        <div className="space-y-3">
          {briefs.map((brief) => {
            const isActive = activeBrief && activeBrief.id === brief.id;

            return (
              <div
                key={brief.id}
                className={[
                  "flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-200",
                  isActive
                    ? "border-brand-pink/70 bg-shell-panel shadow-brand-glow hover:-translate-y-0.5"
                    : "border-shell-border bg-shell-panel/90 hover:-translate-y-0.5 hover:border-brand-pink/40 hover:bg-shell-panel",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-neutral-100">
                      {brief.title}
                    </h2>

                    {brief.trend && (
                      <p className="text-[11px] text-neutral-400">
                        Trend:{" "}
                        <span className="font-medium text-neutral-100">
                          {typeof brief.trend === "string"
                            ? brief.trend
                            : brief.trend.name}
                        </span>
                      </p>
                    )}

                    {brief.objective && (
                      <p className="text-[11px] text-neutral-400">
                        Objective:{" "}
                        <span className="font-medium text-neutral-100">
                          {brief.objective}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-neutral-300">
                      {brief.status}
                    </span>
                    {brief.createdAt && (
                      <span className="text-[10px] text-neutral-500">
                        {new Date(brief.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {brief.summary && (
                  <p className="text-xs text-neutral-300">{brief.summary}</p>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="text-[11px] text-neutral-500">
                    {brief.audienceHint && (
                      <>
                        Audience:{" "}
                        <span className="text-neutral-200">
                          {brief.audienceHint}
                        </span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => generateScriptFromBrief(brief)}
                    className="inline-flex items-center gap-1 rounded-pill bg-brand-pink px-3 py-1 text-[11px] font-semibold text-black transition-colors hover:bg-brand-pink-soft"
                  >
                    Generate script
                    <span className="text-xs">↗</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
