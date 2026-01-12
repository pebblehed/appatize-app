"use client";

import { useBriefContext } from "@/context/BriefContext";
import { useRouter } from "next/navigation";
import { useState } from "react";

function normalizeLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

type BriefFormState = {
  title: string;
  objective: string;
  insight: string;
  creativeDirection: string;
  cta: string;
  hooks: string[];
  deliverables: string[];
};

function emptyForm(): BriefFormState {
  return {
    title: "",
    objective: "",
    insight: "",
    creativeDirection: "",
    cta: "",
    hooks: [],
    deliverables: [],
  };
}

export default function EditBriefPage() {
  const router = useRouter();
  const { selectedBrief, setSelectedBrief } = useBriefContext();

  // Seed from selectedBrief ONCE per mount.
  // If selectedBrief changes, this page should remount (best handled by routing later),
  // but this is still stable for the current flow.
  const [form, setForm] = useState<BriefFormState>(() => {
    if (!selectedBrief) return emptyForm();
    return {
      title: selectedBrief.title || "",
      objective: selectedBrief.objective || "",
      insight: selectedBrief.insight || "",
      creativeDirection: selectedBrief.creativeDirection || "",
      cta: selectedBrief.cta || "",
      hooks: selectedBrief.hooks || [],
      deliverables: selectedBrief.deliverables || [],
    };
  });

  const updateBrief = () => {
    if (!selectedBrief || !selectedBrief.id) return;

    setSelectedBrief({
      ...selectedBrief,
      id: selectedBrief.id,
      ...form,
      fullBrief: { ...form },
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

      <div>
        <label className="text-xs text-neutral-400">Title</label>
        <input
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </div>

      <div>
        <label className="text-xs text-neutral-400">Objective</label>
        <textarea
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200 h-24"
          value={form.objective}
          onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
        />
      </div>

      <div>
        <label className="text-xs text-neutral-400">Insight</label>
        <textarea
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200 h-24"
          value={form.insight}
          onChange={(e) => setForm((f) => ({ ...f, insight: e.target.value }))}
        />
      </div>

      <div>
        <label className="text-xs text-neutral-400">Creative Direction</label>
        <textarea
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200 h-24"
          value={form.creativeDirection}
          onChange={(e) => setForm((f) => ({ ...f, creativeDirection: e.target.value }))}
        />
      </div>

      <div>
        <label className="text-xs text-neutral-400">CTA</label>
        <input
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200"
          value={form.cta}
          onChange={(e) => setForm((f) => ({ ...f, cta: e.target.value }))}
        />
      </div>

      <div>
        <label className="text-xs text-neutral-400">Hooks</label>
        <textarea
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200 h-24"
          value={form.hooks.join("\n")}
          onChange={(e) => setForm((f) => ({ ...f, hooks: normalizeLines(e.target.value) }))}
        />
        <p className="text-[10px] text-neutral-500">One per line</p>
      </div>

      <div>
        <label className="text-xs text-neutral-400">Deliverables</label>
        <textarea
          className="w-full rounded-lg bg-black/30 border border-shell-border px-3 py-2 text-xs text-neutral-200 h-24"
          value={form.deliverables.join("\n")}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              deliverables: normalizeLines(e.target.value),
            }))
          }
        />
        <p className="text-[10px] text-neutral-500">One per line</p>
      </div>

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
