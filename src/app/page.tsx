"use client";

import { useBriefContext } from "@/context/BriefContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

// Local UI-only fields that may exist on a brief at runtime but are not in the core Brief type yet.
// Keeping this local prevents churn in the core engine types while we stabilise the UI.
type BriefUiFields = {
  insight?: string;
  creativeDirection?: string;
  cta?: string;
  hooks?: string[];
  deliverables?: string[];
};

export default function EditBriefPage() {
  const router = useRouter();
  const { activeBrief, setActiveBrief } = useBriefContext();

  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [insight, setInsight] = useState("");
  const [creativeDirection, setCreativeDirection] = useState("");
  const [cta, setCta] = useState("");
  const [hooks, setHooks] = useState<string[]>([]);
  const [deliverables, setDeliverables] = useState<string[]>([]);

  // Deterministic snapshot of brief fields for the form.
  // This avoids ad-hoc setState calls directly driven from context.
  const briefFormSnapshot = useMemo(() => {
    if (!activeBrief) {
      return {
        title: "",
        objective: "",
        insight: "",
        creativeDirection: "",
        cta: "",
        hooks: [] as string[],
        deliverables: [] as string[],
      };
    }

    const ui = activeBrief as unknown as BriefUiFields;

    return {
      title: activeBrief.title || "",
      objective: activeBrief.objective || "",
      insight: ui.insight || "",
      creativeDirection: ui.creativeDirection || "",
      cta: ui.cta || "",
      hooks: Array.isArray(ui.hooks) ? ui.hooks : [],
      deliverables: Array.isArray(ui.deliverables) ? ui.deliverables : [],
    };
  }, [activeBrief]);

  // Sync snapshot → local form state.
  // This is the legitimate use of an effect: synchronising React state to an external source (context snapshot).
  useEffect(() => {
    setTitle(briefFormSnapshot.title);
    setObjective(briefFormSnapshot.objective);
    setInsight(briefFormSnapshot.insight);
    setCreativeDirection(briefFormSnapshot.creativeDirection);
    setCta(briefFormSnapshot.cta);
    setHooks(briefFormSnapshot.hooks);
    setDeliverables(briefFormSnapshot.deliverables);
  }, [briefFormSnapshot]);

  const updateBrief = () => {
    if (!activeBrief) return;

    const next = {
      ...activeBrief,
      title,
      objective,
      // UI-only fields carried alongside the brief object (until we promote them into the core Brief type)
      insight,
      creativeDirection,
      cta,
      hooks,
      deliverables,
      updatedAt: new Date().toISOString(),
    };

    // Cast is intentional: BriefContext's Brief type doesn't include UI-only fields yet.
    setActiveBrief(next as unknown as typeof activeBrief);
  };

  const cancel = () => {
    router.back();
  };

  if (!activeBrief) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">No active brief selected</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Go to Trends → generate a brief, then return here.
        </p>
        <button
          className="mt-4 rounded-md bg-black px-4 py-2 text-sm text-white"
          onClick={() => router.push("/trends")}
        >
          Browse Trends
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Edit Brief</h1>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
            onClick={cancel}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-black px-4 py-2 text-sm text-white"
            onClick={updateBrief}
          >
            Save
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Title</span>
          <input
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Objective</span>
          <input
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Insight</span>
          <textarea
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={insight}
            onChange={(e) => setInsight(e.target.value)}
            rows={3}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Creative direction</span>
          <textarea
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={creativeDirection}
            onChange={(e) => setCreativeDirection(e.target.value)}
            rows={3}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">CTA</span>
          <input
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={cta}
            onChange={(e) => setCta(e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Hooks (comma separated)</span>
          <input
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={hooks.join(", ")}
            onChange={(e) =>
              setHooks(
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Deliverables (comma separated)</span>
          <input
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={deliverables.join(", ")}
            onChange={(e) =>
              setDeliverables(
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </label>
      </div>
    </div>
  );
}
