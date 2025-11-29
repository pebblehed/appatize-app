// src/app/scripts/page.tsx
"use client";

import { useState } from "react";
import { useBriefContext } from "@/context/BriefContext";

/**
 * Supported platform personality modes.
 * We start with these; Energy Modes can be layered later.
 */
type PlatformMode = "tiktok" | "reels" | "shorts" | "x" | "linkedin" | "youtube";

const PLATFORM_MODES: { id: PlatformMode; label: string; hint: string }[] = [
  {
    id: "tiktok",
    label: "TikTok",
    hint: "Fast cuts, on-screen text, native creator voice.",
  },
  {
    id: "reels",
    label: "Reels",
    hint: "Emotional pacing, aesthetic visuals, smoother arcs.",
  },
  {
    id: "shorts",
    label: "Shorts",
    hint: "High energy, punchy, hook-first delivery.",
  },
  {
    id: "x",
    label: "X",
    hint: "Narration-heavy, opinionated, hooky.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    hint: "Professional, insight-led, authority tone.",
  },
  {
    id: "youtube",
    label: "YouTube",
    hint: "A-roll + B-roll structure, chapters, depth.",
  },
];

export default function ScriptsPage() {
  // Be defensive: don’t destructure directly in case the shape changes.
  const briefCtx = useBriefContext() as any;

  // Try multiple possible keys so we align with your existing context shape.
  const activeBrief =
    briefCtx?.activeBrief ??
    briefCtx?.selectedBrief ??
    briefCtx?.currentBrief ??
    briefCtx?.brief ??
    null;

  const [platformMode, setPlatformMode] = useState<PlatformMode>("tiktok");
  const [isGenerating, setIsGenerating] = useState(false);
  const [scriptText, setScriptText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ Safely derive string values for display
  const briefTitle: string | null = (() => {
    if (!activeBrief?.title) return null;
    if (typeof activeBrief.title === "string") return activeBrief.title;
    return (
      activeBrief.title?.name ||
      activeBrief.title?.label ||
      activeBrief.title?.text ||
      "[Untitled brief]"
    );
  })();

  const briefTrend: string | null = (() => {
    if (!activeBrief?.trend) return null;
    if (typeof activeBrief.trend === "string") return activeBrief.trend;
    return (
      activeBrief.trend?.name ||
      activeBrief.trend?.label ||
      activeBrief.trend?.description ||
      "[Selected trend]"
    );
  })();

  const briefObjective: string | null = (() => {
    if (!activeBrief?.objective) return null;
    if (typeof activeBrief.objective === "string") return activeBrief.objective;
    return (
      activeBrief.objective?.summary ||
      activeBrief.objective?.text ||
      "[Objective]"
    );
  })();

  /**
   * Call your existing script generation API.
   * We simply add `platformMode` to the payload.
   *
   * Backwards-compatible: if the API ignores this field for now,
   * nothing breaks. Once we update the API, it "wakes up".
   */
  const handleGenerate = async () => {
    if (!activeBrief) {
      setError("No active brief detected. Go to Briefs and select one.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/scripts/generate", {
        // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        // key change: /api/generate instead of /api/scripts/generate
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: activeBrief,
          platformMode, // 🔑 new param
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Adjust this line to match your existing response shape.
      // e.g. data.script, data.content, data.result, etc.
      setScriptText(data.script ?? "No script returned from API.");
    } catch (err: any) {
      console.error("[ScriptsPage] Generate error:", err);
      setError(err.message || "Failed to generate script.");
    } finally {
      setIsGenerating(false);
    }
  };

  const hasBrief = Boolean(activeBrief);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scripts</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Turn your brief into platform-native creator scripts. Start by
          choosing a platform mode.
        </p>
      </div>

      {/* Layout: left = controls, right = script output */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
        {/* Left column: Platform selector + actions + brief summary */}
        <div className="space-y-4">
          {/* Platform Mode selector card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-medium text-neutral-200">
                  Platform Mode
                </h2>
                <p className="text-xs text-neutral-500">
                  Scripts will be styled for this platform&apos;s native
                  language and pacing.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {PLATFORM_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPlatformMode(mode.id)}
                  className={[
                    "rounded-xl border px-3 py-2 text-xs text-left transition",
                    platformMode === mode.id
                      ? "border-emerald-400/90 bg-emerald-500/10 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.4)]"
                      : "border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900",
                  ].join(" ")}
                >
                  <div className="font-medium mb-0.5">{mode.label}</div>
                  <div className="text-[10px] text-neutral-400 leading-snug">
                    {mode.hint}
                  </div>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-neutral-500">
              🔁 You can change this and regenerate to see how the engine adapts
              the same idea to different platforms.
            </p>
          </div>

          {/* Brief summary + Generate button */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-neutral-200">
                  Active Brief
                </h2>
                {!hasBrief && (
                  <p className="text-xs text-red-400 mt-1">
                    No active brief found. Go to the{" "}
                    <span className="font-semibold">Briefs</span> tab, pick a
                    brief, and come back.
                  </p>
                )}
              </div>

            <button
                type="button"
                onClick={handleGenerate}
                disabled={!hasBrief || isGenerating}
                className={[
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition",
                  !hasBrief || isGenerating
                    ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    : "bg-emerald-500 text-neutral-950 hover:bg-emerald-400",
                ].join(" ")}
              >
                {isGenerating ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-neutral-900 border-t-transparent" />
                    Generating…
                  </>
                ) : (
                  <>
                    <span>Generate script</span>
                    <span className="text-[10px] uppercase tracking-wide opacity-80">
                      {platformMode}
                    </span>
                  </>
                )}
              </button>
            </div>

            {hasBrief && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
                <div className="text-[11px] text-neutral-400 uppercase tracking-wide mb-1">
                  Brief snapshot
                </div>
                <div className="space-y-1.5 text-xs text-neutral-300">
                  {briefTitle && (
                    <p>
                      <span className="text-neutral-500">Title:</span>{" "}
                      {briefTitle}
                    </p>
                  )}
                  {briefTrend && (
                    <p>
                      <span className="text-neutral-500">Trend:</span>{" "}
                      {briefTrend}
                    </p>
                  )}
                  {briefObjective && (
                    <p>
                      <span className="text-neutral-500">Objective:</span>{" "}
                      {briefObjective}
                    </p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Script output */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-medium text-neutral-200">
                Script Output
              </h2>
              <p className="text-xs text-neutral-500">
                Platform-aware script for{" "}
                <span className="font-semibold">{platformMode}</span>.
              </p>
            </div>
          </div>

          <div className="relative flex-1 rounded-xl border border-neutral-800 bg-neutral-950/80 p-3 text-xs text-neutral-100 overflow-auto">
            {!scriptText && (
              <p className="text-neutral-500">
                No script generated yet. Choose a{" "}
                <span className="font-semibold">Platform Mode</span>, make sure
                a brief is active, then click{" "}
                <span className="font-semibold">Generate script</span>.
              </p>
            )}

            {scriptText && (
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {scriptText}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
