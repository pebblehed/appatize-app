"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ApiTrend = {
  id: string;
  status?: string;
  name: string;
  description: string;
  momentumLabel?: string;
  category?: string;
};

type TrendsLiveResponse = {
  source?: string;
  status: "ok" | "unavailable";
  count: number;
  trends: ApiTrend[];
  message?: string;
  debug?: any;
};

// Map backend status strings into UI labels/classes (simple + deterministic)
function statusToUi(status?: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("emerg")) return { label: "Emerging", className: "text-trend-emerging" };
  if (s.includes("peak")) return { label: "Peaking", className: "text-trend-peaking" };
  if (s.includes("declin")) return { label: "Declining", className: "text-trend-declining" };
  return { label: "Stable", className: "text-trend-stable" };
}

export default function HomePage() {
  // Default snapshot source for the Radar (change pack anytime)
  const DEFAULT_PACK = "fragrance";
  const DEFAULT_LIMIT = 3;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trends, setTrends] = useState<ApiTrend[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/trends/live?pack=${encodeURIComponent(DEFAULT_PACK)}&limit=${DEFAULT_LIMIT}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch live snapshot: ${res.status} ${res.statusText}`);
        }

        const data = (await res.json()) as TrendsLiveResponse;

        if (cancelled) return;

        if (data.status !== "ok" || !Array.isArray(data.trends)) {
          setTrends([]);
          setError(data.message || "Live radar unavailable right now.");
        } else {
          setTrends(data.trends.slice(0, DEFAULT_LIMIT));
        }
      } catch {
        if (cancelled) return;
        setTrends([]);
        setError("Live radar unavailable right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cultural Radar</h1>
        <p className="text-sm text-neutral-400">
          A signal-backed system that turns live cultural moments into briefs and creator-native scripts.
        </p>
      </header>

      {/* Main grid: snapshot + CTA column */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left / centre: Live trend snapshot */}
        <section className="relative overflow-hidden rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6 shadow-ring-soft md:col-span-2">
          {/* Badge (truthful) */}
          <div className="absolute right-4 top-4">
            <span className="inline-flex items-center rounded-pill border border-brand-pink/40 bg-brand-pink/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-brand-pink">
              Live signal preview
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-neutral-200">Cultural Radar Snapshot</h2>
              <p className="max-w-xl text-xs text-neutral-400">
                Pulled from live signals (Reddit for now). If upstream is unavailable, we show an honest empty state.
              </p>
            </div>

            {/* Loading / error / empty */}
            {loading && (
              <div className="rounded-2xl border border-shell-border bg-black/20 p-4 text-xs text-neutral-400">
                Loading live snapshot…
              </div>
            )}

            {!loading && error && (
              <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-xs text-red-200">
                {error}
              </div>
            )}

            {!loading && !error && trends.length === 0 && (
              <div className="rounded-2xl border border-shell-border bg-black/20 p-4 text-xs text-neutral-400">
                No live trends returned right now.
              </div>
            )}

            {/* Live trend cards */}
            {!loading && !error && trends.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {trends.map((t) => {
                  const ui = statusToUi(t.status);

                  return (
                    <article
                      key={t.id}
                      className="rounded-2xl border border-shell-border bg-black/20 px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-pink/40 hover:shadow-brand-glow/40"
                    >
                      <p
                        className={`mb-2 text-[11px] font-medium uppercase tracking-[0.16em] ${ui.className}`}
                      >
                        {ui.label}
                      </p>

                      <h3 className="mb-1 text-sm font-semibold text-neutral-50">{t.name}</h3>

                      {t.momentumLabel && (
                        <p className="mb-1 text-[11px] text-neutral-500">{t.momentumLabel}</p>
                      )}

                      <p className="mb-3 text-xs text-neutral-400">{t.description}</p>

                      {t.category && <p className="mb-3 text-[11px] text-neutral-500">{t.category}</p>}

                      <Link
                        href="/trends"
                        className="text-[11px] font-medium text-brand-pink transition-colors hover:text-brand-pink-soft"
                      >
                        View in Trends →
                      </Link>
                    </article>
                  );
                })}

                {/* If only 1 trend comes back, keep layout tidy by adding a CTA tile */}
                {trends.length === 1 && (
                  <article className="rounded-2xl border border-shell-border bg-black/10 px-4 py-4">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                      Next step
                    </p>
                    <h3 className="mb-1 text-sm font-semibold text-neutral-50">Open the full Trends feed</h3>
                    <p className="mb-3 text-xs text-neutral-400">
                      Choose a pack and apply your strategy lens to narrow what you&apos;re viewing.
                    </p>
                    <Link
                      href="/trends"
                      className="text-[11px] font-medium text-brand-pink transition-colors hover:text-brand-pink-soft"
                    >
                      Browse Trends →
                    </Link>
                  </article>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right column: MVP flow CTA */}
        <aside className="flex flex-col gap-3 rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6 shadow-ring-soft">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-neutral-100">Start your MVP flow</h2>
            <p className="text-xs text-neutral-400">
              For the MVP: pick a trend → generate a brief → generate a script.
            </p>
          </div>

          <div className="mt-1 flex flex-col gap-2">
            <Link
              href="/trends"
              className="w-full rounded-pill bg-brand-pink px-4 py-2.5 text-xs font-semibold text-white shadow-brand-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-pink-soft"
            >
              Browse Trends
            </Link>

            <Link
              href="/briefs"
              className="w-full rounded-pill border border-shell-border bg-black/30 px-4 py-2.5 text-xs font-medium text-neutral-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-black/50 hover:border-brand-pink/40"
            >
              View Briefs
            </Link>

            <Link
              href="/scripts"
              className="w-full rounded-pill border border-shell-border bg-black/10 px-4 py-2.5 text-xs font-medium text-neutral-300 transition-all duration-200 hover:-translate-y-0.5 hover:bg-black/30"
            >
              Open Scripts
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
