// The "AI Summary" callout — one takeaway per line of `aiSummary`. Shown on the full article and
// on the signed-out preview, so visitors get the gist before signing in.
export function ArticleAiSummary({ summary, className = '' }: { summary: string | null; className?: string }) {
  const points =
    summary
      ?.split('\n')
      .map((p) => p.trim())
      .filter(Boolean) ?? [];
  if (points.length === 0) return null;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--accent)_22%,transparent)] bg-[color-mix(in_oklab,var(--accent)_6%,var(--bg-alt))] p-5 min-[640px]:p-6 ${className}`}
    >
      <div className="mb-3.5 flex items-center gap-2">
        <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-accent text-bg-card">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <span className="text-mono-label font-bold text-accent">AI SUMMARY</span>
        <span className="art-ai-pulse ml-auto h-1.5 w-1.5 flex-none rounded-full bg-accent" />
      </div>
      <ul className="relative flex flex-col gap-2.5">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.55] text-ink-2">
            <span className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--accent)_15%,transparent)] text-[8px] font-bold text-accent">
              ✦
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
