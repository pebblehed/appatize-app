// src/app/briefs/page.tsx
"use client";

import { useRouter } from "next/navigation";
import {
  useBriefContext,
  type Brief,
} from "@/context/BriefContext";
import {
  PLATFORM_PATTERNS,
  type PlatformId,
} from "@/engine/platforms";

type PlatformSelectValue = "auto" | PlatformId;

const PLATFORM_OPTIONS: { value: PlatformSelectValue; label: string }[] = [
  { value: "auto", label: "Auto (engine decides)" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram_reels", label: "Instagram Reels" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "x", label: "X / Twitter" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "snapchat", label: "Snapchat" },
];

export default function BriefsPage() {
  const router = useRouter();
  const {
    briefs,
    activeBrief,
    setActiveBrief,
    setBriefs,
  } = useBriefContext();

  const hasBriefs = briefs && briefs.length > 0;

  // Open in Script Generator
  const openInScripts = (brief: Brief) => {
    setActiveBrief(brief);
    router.push("/scripts");
  };

  const handlePlatformOverrideChange = (
    briefId: string,
    value: PlatformSelectValue
  ) => {
    setBriefs((prev) =>
      prev.map((b) => {
        if (b.id !== briefId) return b;

        const updated: Brief = {
          ...b,
          platformOverride: value === "auto" ? undefined : value,
        };

        // Keep activeBrief in sync if it’s the same one
        if (activeBrief && activeBrief.id === briefId) {
          setActiveBrief(updated);
        }

        return updated;
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Briefs</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Angle-powered creative briefs generated from trends. Pick one to open
          it in the Script Generator and turn it into platform-native content.
        </p>
      </div>

      {/* Empty state */}
      {!hasBriefs && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-6 text-sm text-neutral-400">
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

            const selectedOverride =
              (brief.platformOverride as PlatformSelectValue | undefined) ??
              "auto";

            const inferredPlatformId =
              selectedOverride === "auto"
                ? undefined
                : selectedOverride;

            const inferredLabel =
              inferredPlatformId && PLATFORM_PATTERNS[inferredPlatformId]
                ? PLATFORM_PATTERNS[inferredPlatformId].shortLabel
                : brief.platformHint || "Auto";

            return (
              <div
                key={brief.id}
                className={[
                  "flex flex-col gap-3 rounded-2xl border p-4 transition",
                  isActive
                    ? "border-emerald-400/70 bg-neutral-950/80 shadow-[0_0_0_1px_rgba(16,185,129,0.4)]"
                    : "border-neutral-800 bg-neutral-950/70 hover:border-neutral-700 hover:bg-neutral-900/80",
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
                    <span className="inline-flex items-center rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-300">
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
                  <p className="text-xs text-neutral-300">
                    {brief.summary}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-col gap-1 text-[11px] text-neutral-500">
                    {brief.audienceHint && (
                      <div>
                        Audience:{" "}
                        <span className="text-neutral-200">
                          {brief.audienceHint}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-neutral-500">
                        Platform for scripts:
                      </span>
                      <select
                        value={selectedOverride}
                        onChange={(e) =>
                          handlePlatformOverrideChange(
                            brief.id,
                            e.target.value as PlatformSelectValue
                          )
                        }
                        className="rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-[11px] text-neutral-200 outline-none focus:border-brand-pink/60"
                      >
                        {PLATFORM_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-neutral-500">
                        Engine will treat this as:{" "}
                        <span className="text-neutral-300">
                          {inferredLabel}
                        </span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openInScripts(brief)}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-black transition hover:bg-emerald-400"
                  >
                    Open in Script Generator
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
