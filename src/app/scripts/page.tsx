// src/app/scripts/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useBriefContext } from "@/context/BriefContext";

export default function ScriptsPage() {
  const { selectedBrief } = useBriefContext();
  const [script, setScript] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadScript() {
      if (!selectedBrief || selectedBrief.status !== "AI-generated") return;

      setLoading(true);

      const res = await fetch("/api/generateScript", {
        method: "POST",
        body: JSON.stringify({ brief: selectedBrief.fullBrief }),
      });

      const result = await res.json();
      setScript(result.script);

      setLoading(false);
    }

    loadScript();
  }, [selectedBrief]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Scripts</h1>
        <p className="text-sm text-neutral-400">
          Platform-native scripts generated from your brief.
        </p>
      </header>

      {/* Loading state */}
      {loading && (
        <section className="rounded-2xl border border-brand-pink/60 bg-shell-panel p-4 text-xs shadow-brand-glow">
          <p className="text-neutral-200">Generating script…</p>
        </section>
      )}

      {/* AI-Generated Script */}
      {script && (
        <section className="rounded-2xl border border-brand-pink/60 bg-shell-panel p-4 text-xs shadow-brand-glow space-y-4">
          <h2 className="text-sm font-semibold text-brand-pink">
            AI Script • {selectedBrief?.title}
          </h2>

          <div className="space-y-3 text-neutral-200">
            <p><strong>HOOK:</strong> {script.hook}</p>
            <p><strong>BEAT 1:</strong> {script.beat1}</p>
            <p><strong>BEAT 2:</strong> {script.beat2}</p>
            <p><strong>BEAT 3:</strong> {script.beat3}</p>
            <p><strong>ENDING:</strong> {script.ending}</p>

            <div>
              <strong>CAPTIONS:</strong>
              <ul className="list-disc pl-6 mt-1">
                {script.captions?.map((c: string, i: number) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* If no brief yet */}
      {!script && !loading && (
        <section className="rounded-2xl border border-shell-border bg-shell-panel p-4 text-xs text-neutral-300 shadow-ring-soft">
          Select a brief and click “Generate script” to see the output here.
        </section>
      )}
    </div>
  );
}
