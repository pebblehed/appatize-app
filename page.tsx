"use client";

import { useBriefContext } from "@/context/BriefContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function EditBriefPage() {
  const router = useRouter();
  const { selectedBrief, setSelectedBrief } = useBriefContext();

  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [insight, setInsight] = useState("");
  const [creativeDirection, setCreativeDirection] = useState("");
  const [cta, setCta] = useState("");
  const [hooks, setHooks] = useState<string[]>([]);
  const [deliverables, setDeliverables] = useState<string[]>([]);

  // Load brief into editor
  useEffect(() => {
    if (!selectedBrief) return;

    setTitle(selectedBrief.title || "");
    setObjective(selectedBrief.objective || "");
    setInsight(selectedBrief.insight || "");
    setCreativeDirection(selectedBrief.creativeDirection || "");
    setCta(selectedBrief.cta || "");
    setHooks(selectedBrief.hooks || []);
    setDeliverables(selectedBrief.deliverables || []);
  }, [selectedBrief]);

  const updateBrief = () => {
    setSelectedBrief({
      ...selectedBrief,
      title,
      objective,
      insight,
      creativeDirection,
      cta,
      hooks,
      deliverables,
      fullBrief: {
        title,
        objective,
        insight,
        creativeDirection,
        cta,
        hooks,
        deliverables,
      },
    });

    router.push("/scripts");
  };

  if (!selectedBrief) {
    return (
      <div className="text-neutral-300 text-xs">
        No brief selected. Return to /briefs and open one to edit.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Edit Brief</h1>
        <p className="text-neutral-400 text-sm">
          Adjust your brief before generating final scripts.
        </p>
      </header>

      {/* Title */}
      <div>
        <label className="text-xs text-neutral-400">Title</label>
        <input
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Objective */}
      <div>
        <label className="text-xs text-neutral-400">Objective</label>
        <textarea
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200 h-24"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />
      </div>

      {/* Insight */}
      <div>
        <label className="text-xs text-neutral-400">Insight</label>
        <textarea
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200 h-24"
          value={insight}
          onChange={(e) => setInsight(e.target.value)}
        />
      </div>

      {/* Creative Direction */}
      <div>
        <label className="text-xs text-neutral-400">Creative Direction</label>
        <textarea
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200 h-24"
          value={creativeDirection}
          onChange={(e) => setCreativeDirection(e.target.value)}
        />
      </div>

      {/* CTA */}
      <div>
        <label className="text-xs text-neutral-400">CTA</label>
        <input
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200"
          value={cta}
          onChange={(e) => setCta(e.target.value)}
        />
      </div>

      {/* Hooks */}
      <div>
        <label className="text-xs text-neutral-400">Hooks</label>
        <textarea
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200 h-24"
          value={hooks.join("\n")}
          onChange={(e) => setHooks(e.target.value.split("\n"))}
        />
        <p className="text-[10px] text-neutral-500">One per line</p>
      </div>

      {/* Deliverables */}
      <div>
        <label className="text-xs text-neutral-400">Deliverables</label>
        <textarea
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200 h-24"
          value={deliverables.join("\n")}
          onChange={(e) => setDeliverables(e.target.value.split("\n"))}
        />
        <p className="text-[10px] text-neutral-500">One per line</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={updateBrief}
          className="rounded-pill bg-brand-pink px-4 py-2 text-xs font-semibold text-white shadow-brand-glow hover:-translate-y-0.5"
        >
          Save & Generate Script
        </button>

        <button
          className="rounded-pill border border-shell-border bg-black/30 px-4 py-2 text-xs text-neutral-300"
          onClick={() => router.push("/briefs")}
        >
          Back
        </button>
      </div>
    </div>
  );
}
