import Link from 'next/link';

// Numbered page bar: ← 1 … 4 5 6 … 12 →. Either link-driven (`hrefFor`, for pages whose page
// number lives in the URL) or callback-driven (`onPageChange`, for client-side lists). Renders
// nothing for a single page.

type Props = {
  page: number;
  totalPages: number;
  className?: string;
} & (
  | { hrefFor: (page: number) => string; onPageChange?: never }
  | { onPageChange: (page: number) => void; hrefFor?: never }
);

// The pages to show: first, last, and the current page ±1, with gaps marked by null.
function pageItems(page: number, totalPages: number): (number | null)[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  // Fill a single-page gap with the page itself rather than an ellipsis.
  if (wanted.has(3) && totalPages > 3) wanted.add(2);
  if (wanted.has(totalPages - 2) && totalPages > 3) wanted.add(totalPages - 1);
  const sorted = [...wanted].sort((a, b) => a - b);
  const items: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push(null);
    items.push(p);
  });
  return items;
}

const BASE =
  'inline-flex h-10 min-w-10 max-[480px]:h-9 max-[480px]:min-w-9 items-center justify-center rounded-input px-3 text-sm font-medium transition-colors';
const IDLE = 'border border-line bg-bg-card text-ink-2 hover:border-ink hover:text-ink';
const CURRENT = 'border border-ink bg-ink text-bg';
const DISABLED = 'border border-line bg-bg-card text-ink-4 opacity-50';

export function Pagination({ page, totalPages, className = '', hrefFor, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  function control(target: number, label: string, content: string, current = false) {
    const disabled = target < 1 || target > totalPages;
    const cls = `${BASE} ${current ? CURRENT : disabled ? DISABLED : IDLE}`;
    if (disabled) {
      return (
        <span aria-disabled="true" aria-label={label} className={cls}>
          {content}
        </span>
      );
    }
    if (hrefFor) {
      return (
        <Link href={hrefFor(target)} aria-label={label} aria-current={current ? 'page' : undefined} className={cls}>
          {content}
        </Link>
      );
    }
    return (
      <button
        type="button"
        aria-label={label}
        aria-current={current ? 'page' : undefined}
        className={cls}
        onClick={() => onPageChange?.(target)}
      >
        {content}
      </button>
    );
  }

  return (
    <nav aria-label="Pagination" className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      {control(page - 1, 'Previous page', '←')}
      {pageItems(page, totalPages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-sm text-ink-4">
            …
          </span>
        ) : (
          <span key={p} className="contents">
            {control(p, `Page ${p}`, String(p), p === page)}
          </span>
        )
      )}
      {control(page + 1, 'Next page', '→')}
    </nav>
  );
}
