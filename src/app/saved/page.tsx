// src/app/saved/page.tsx
export default function SavedPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Saved</h1>
        <p className="text-sm text-neutral-400">
          A simple place where saved trends, briefs and scripts will live in the MVP.
        </p>
      </header>

      <section className="rounded-2xl border border-shell-border bg-shell-panel p-6 text-xs text-neutral-300 shadow-ring-soft">
        <p className="mb-2">
          In the live product, this view will become your team&apos;s library of:
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Pinned or favourited trends</li>
          <li>Approved briefs ready to use again</li>
          <li>Scripts that performed well and should be reused</li>
        </ul>
        <p className="mt-4 text-neutral-500">
          For now, this is a placeholder so we can see the full CultureOS flow end-to-end.
        </p>
      </section>
    </div>
  );
}
