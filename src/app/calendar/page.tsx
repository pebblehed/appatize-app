// src/app/calendar/page.tsx
export default function CalendarPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-neutral-400">
          Later, this becomes your content calendar: plan drops, campaigns and experiments.
        </p>
      </header>

      <section className="rounded-2xl border border-shell-border bg-shell-panel p-6 text-xs text-neutral-300 shadow-ring-soft">
        <p className="mb-3">
          In the MVP, this can start as a simple list or grid of planned posts —
          then grow into:
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Sync with trends and briefs</li>
          <li>Assign owners and due dates</li>
          <li>Tag platforms and formats</li>
        </ul>
        <p className="mt-4 text-neutral-500">
          For now, treat this as a visual placeholder so the CultureOS shell feels complete.
        </p>
      </section>
    </div>
  );
}
