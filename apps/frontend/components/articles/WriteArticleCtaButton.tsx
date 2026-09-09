import Link from 'next/link';

const STAR_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

// Matches design/static_html/assets/styles.css's `.anv-write-cta-btn` exactly — a distinct,
// more saturated green (see globals.css's `--cta` token) than the rest of the app's buttons,
// used only for this one call to action. Two call sites: the articles page's tab row and the
// My Articles empty state (design/static_html/articles.html's `#anv-write-btn` /
// `#anv-my-empty-write-btn`, same class on both).
export function WriteArticleCtaButton({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/articles/write"
      className={`inline-flex items-center gap-2 rounded-[10px] bg-cta px-[18px] py-2.5 text-[13.5px] font-semibold text-bg-card transition-all hover:-translate-y-px hover:bg-cta-hover ${className}`.trim()}
    >
      {STAR_ICON}
      Write an Article
    </Link>
  );
}
