// The countries an article is about, behind a location pin — nothing when it has none. Shared by the
// article cards and the homepage's latest-articles list so the two read the same.
export function ArticleCountries({ countries, className = '' }: { countries: string[]; className?: string }) {
  if (countries.length === 0) return null;
  const label = countries.join(', ');
  return (
    <div className={`flex min-w-0 items-center gap-1 text-xs text-ink-3 ${className}`}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        className="flex-none text-ink-4"
      >
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <span className="truncate" title={label}>
        {label}
      </span>
    </div>
  );
}
