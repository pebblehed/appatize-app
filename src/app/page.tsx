// src/app/page.tsx
import Link from "next/link";

export default function RadarPage() {
  return (
    <div className="space-y-8">
      {/* Page heading */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cultural Radar
        </h1>
        <p className="text-sm text-neutral-400">
          See what&apos;s moving in culture, then turn it into creator-style
          content in seconds.
        </p>
      </header>

      {/* Main grid: snapshot + CTA column */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left / centre: Live trend snapshot */}
        <section className="relative overflow-hidden rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6 shadow-ring-soft md:col-span-2">
          {/* Badge */}
          <div className="absolute right-4 top-4">
            <span className="inline-flex items-center rounded-pill border border-brand-pink/40 bg-brand-pink/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-brand-pink">
              MVP • Mock Data
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-neutral-200">
                Live Trend Snapshot
              </h2>
              <p className="max-w-xl text-xs text-neutral-400">
                In the MVP, we&apos;ll start with a curated list of active
                trends. Later, this view becomes a fully live cultural radar.
              </p>
            </div>

            {/* Trend cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Emerging trend */}
              <article className="rounded-2xl border border-shell-border bg-black/20 px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-pink/40 hover:shadow-brand-glow/40">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-trend-emerging">
                  Emerging
                </p>
                <h3 className="mb-1 text-sm font-semibold text-neutral-50">
                  &quot;Street POV micro-vlogs&quot;
                </h3>
                <p className="mb-3 text-xs text-neutral-400">
                  Rising POV-style videos with raw, handheld city footage.
                </p>
                <Link
                  href="#"
                  className="text-[11px] font-medium text-brand-pink transition-colors hover:text-brand-pinkSoft"
                >
                  View in Trends →
                </Link>
              </article>

              {/* Peaking trend */}
              <article className="rounded-2xl border border-shell-border bg-black/20 px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-pink/40 hover:shadow-brand-glow/40">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-trend-peaking">
                  Peaking
                </p>
                <h3 className="mb-1 text-sm font-semibold text-neutral-50">
                  &quot;Day-in-the-life work content&quot;
                </h3>
                <p className="mb-3 text-xs text-neutral-400">
                  Relatable behind-the-scenes content showing real workflows.
                </p>
                <Link
                  href="#"
                  className="text-[11px] font-medium text-brand-pink transition-colors hover:text-brand-pinkSoft"
                >
                  Turn into a brief →
                </Link>
              </article>
            </div>
          </div>
        </section>

        {/* Right column: MVP flow CTA */}
        <aside className="flex flex-col gap-3 rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6 shadow-ring-soft">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-neutral-100">
              Start your MVP flow
            </h2>
            <p className="text-xs text-neutral-400">
              For the MVP, our goal is simple: pick a trend → generate a brief
              → generate a script.
            </p>
          </div>

          <div className="mt-1 flex flex-col gap-2">
            <button className="w-full rounded-pill bg-brand-pink px-4 py-2.5 text-xs font-semibold text-white shadow-brand-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-pinkSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/70 active:translate-y-0">
              Browse Trends
            </button>

            <button className="w-full rounded-pill border border-shell-border bg-black/30 px-4 py-2.5 text-xs font-medium text-neutral-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-black/50 hover:border-brand-pink/40 active:translate-y-0">
              View Briefs
            </button>

            <button className="w-full rounded-pill border border-shell-border bg-black/10 px-4 py-2.5 text-xs font-medium text-neutral-300 transition-all duration-200 hover:-translate-y-0.5 hover:bg-black/30 active:translate-y-0">
              Saved Scripts
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
