// src/app/briefs/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBriefContext, type Brief } from "@/context/BriefContext";
import { PLATFORM_PATTERNS, type PlatformId } from "@/engine/platforms";
import { cleanText } from "@/engine/cleanText";

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

/**
 * Strategy Lens (DOWNSTREAM ONLY)
 * - This MUST NOT influence: moment qualification, ranking, decision state, confidence, or signal strength.
 * - It is a chosen interpretive lens that shapes how we express the response (angles/scripts), not what the moment is.
 *
 * Storage:
 * - We keep this in localStorage keyed by brief.id to avoid changing the Brief type or upstream contracts.
 * - Scripts page can read it from the query param (?lens=...) and/or localStorage later.
 */
type StrategyLensId =
  | "none"
  | "growth"
  | "brand_trust"
  | "challenger"
  | "community"
  | "performance"
  | "pr_comms";

const STRATEGY_LENS_OPTIONS: { value: StrategyLensId; label: string }[] = [
  { value: "none", label: "No lens (default)" },
  { value: "growth", label: "Growth / Acquisition" },
  { value: "brand_trust", label: "Brand Trust / Safety" },
  { value: "challenger", label: "Challenger / Disruptive" },
  { value: "community", label: "Community / Belonging" },
  { value: "performance", label: "Performance / Conversion" },
  { value: "pr_comms", label: "PR / Comms-ready" },
];

function lensStorageKey(briefId: string) {
  return `appatize:strategyLens:${briefId}`;
}

function safeGetLocalStorage(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore write failures (private mode / blocked storage)
  }
}

export default function BriefsPage() {
  const router = useRouter();
  const { briefs, activeBrief, setActiveBrief, setBriefs } = useBriefContext();

  const hasBriefs = briefs && briefs.length > 0;

  // Local UI state: per-brief Strategy Lens selections (kept out of Brief type)
  const [lensByBriefId, setLensByBriefId] = useState<Record<string, StrategyLensId>>({});

  // Hydrate lens selections from localStorage when briefs load/change
  useEffect(() => {
    if (!hasBriefs) return;

    const next: Record<string, StrategyLensId> = {};
    for (const b of briefs) {
      const raw = safeGetLocalStorage(lensStorageKey(b.id));
      const isValid = STRATEGY_LENS_OPTIONS.some((o) => o.value === raw);
      next[b.id] = (isValid ? (raw as StrategyLensId) : "none") ?? "none";
    }
    setLensByBriefId(next);
  }, [hasBriefs, briefs]);

  const openInScripts = (brief: Brief) => {
    // Keep activeBrief in context (existing behaviour)
    setActiveBrief(brief);

    // Attach lens as downstream-only hint (does not alter moment truth)
    const lens = lensByBriefId[brief.id] ?? "none";
    safeSetLocalStorage(lensStorageKey(brief.id), lens);

    const query = lens && lens !== "none" ? `?lens=${encodeURIComponent(lens)}` : "";
    router.push(`/scripts${query}`);
  };

  const handlePlatformOverrideChange = (briefId: string, value: PlatformSelectValue) => {
    setBriefs((prev) =>
      prev.map((b) => {
        if (b.id !== briefId) return b;

        // NOTE: We do not add lens to Brief objects here (by design).
        // Lens is stored separately in localStorage so we don’t change upstream types/contracts.
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

  const handleStrategyLensChange = (briefId: string, value: StrategyLensId) => {
    setLensByBriefId((prev) => {
      const next = { ...prev, [briefId]: value };
      return next;
    });
    safeSetLocalStorage(lensStorageKey(briefId), value);
  };

  const lensMicrocopy = useMemo(() => {
    return "Interpret this moment through a strategy lens. The moment itself does not change.";
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Briefs</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Angle-powered creative briefs generated from trends. Pick one to open it in the Script Generator and
          turn it into platform-native content.
        </p>
      </div>

      {/* Empty state */}
      {!hasBriefs && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-6 text-sm text-neutral-400">
          You don&apos;t have any briefs yet. Start from the{" "}
          <span className="font-semibold text-neutral-200">Trends</span> view, choose a trend, and either turn it
          into a brief or pick an angle.
        </div>
      )}

      {/* Brief list */}
      {hasBriefs && (
        <div className="space-y-3">
          {briefs.map((brief) => {
            const isActive = activeBrief && activeBrief.id === brief.id;

            const selectedOverride =
              (brief.platformOverride as PlatformSelectValue | undefined) ?? "auto";

            const inferredPlatformId = selectedOverride === "auto" ? undefined : selectedOverride;

            const inferredLabel =
              inferredPlatformId && PLATFORM_PATTERNS[inferredPlatformId]
                ? PLATFORM_PATTERNS[inferredPlatformId].shortLabel
                : brief.platformHint || "Auto";

            // Cleaned display fields (hyphen / AI-detox pass)
            const titleText = cleanText(brief.title || "Untitled brief");

            const trendNameRaw =
              typeof brief.trend === "string" ? brief.trend : brief.trend?.name;
            const trendNameText = trendNameRaw ? cleanText(trendNameRaw) : null;

            const objectiveText = brief.objective ? cleanText(brief.objective) : null;

            const summaryText = brief.summary ? cleanText(brief.summary) : null;

            const audienceText = brief.audienceHint ? cleanText(brief.audienceHint) : null;

            const selectedLens = lensByBriefId[brief.id] ?? "none";

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
                    <h2 className="text-sm font-semibold text-neutral-100">{titleText}</h2>

                    {trendNameText && (
                      <p className="text-[11px] text-neutral-400">
                        Trend: <span className="font-medium text-neutral-100">{trendNameText}</span>
                      </p>
                    )}

                    {objectiveText && (
                      <p className="text-[11px] text-neutral-400">
                        Objective: <span className="font-medium text-neutral-100">{objectiveText}</span>
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

                {summaryText && <p className="text-xs text-neutral-300">{summaryText}</p>}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-col gap-2 text-[11px] text-neutral-500">
                    {audienceText && (
                      <div>
                        Audience: <span className="text-neutral-200">{audienceText}</span>
                      </div>
                    )}

                    {/* Strategy Lens (secondary, downstream only) */}
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-neutral-500">Strategy Lens:</span>
                        <select
                          value={selectedLens}
                          onChange={(e) => handleStrategyLensChange(brief.id, e.target.value as StrategyLensId)}
                          className="rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-[11px] text-neutral-200 outline-none focus:border-brand-pink/60"
                        >
                          {STRATEGY_LENS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <p className="text-[10px] leading-snug text-neutral-600">
                        {lensMicrocopy}
                      </p>
                    </div>

                    {/* Platform override */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-neutral-500">Platform for scripts:</span>
                      <select
                        value={selectedOverride}
                        onChange={(e) =>
                          handlePlatformOverrideChange(brief.id, e.target.value as PlatformSelectValue)
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
                        Engine will treat this as: <span className="text-neutral-300">{inferredLabel}</span>
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
