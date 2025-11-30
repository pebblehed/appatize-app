// src/app/calendar/page.tsx
export default function CalendarPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-neutral-400">
          Later, this becomes your Appatize content calendar — plan drops,
          campaigns, and experiments based on cultural signals.
        </p>
      </header>

      <section className="rounded-2xl border border-shell-border bg-shell-panel p-6 text-xs text-neutral-300 shadow-ring-soft">
        <p className="mb-3">
          In the MVP, this begins as a simple list or grid of planned posts.
          Over time, this evolves into a full intelligence-driven calendar
          connected to your briefs, scripts, and trend movements:
        </p>

        <ul className="list-disc space-y-1 pl-4">
          <li>Sync with trends and active briefs</li>
          <li>Assign owners, due dates, and campaign phases</li>
          <li>Tag platforms, formats, angles, and CTAs</li>
        </ul>

        <p className="mt-4 text-neutral-500">
          For now, this is a visual placeholder so the Appatize shell feels
          complete while we wire in the live intelligence layer.
        </p>
      </section>
    </div>
  );
}
