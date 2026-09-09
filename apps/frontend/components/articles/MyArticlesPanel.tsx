import Link from 'next/link';
import { WriteArticleCtaButton } from '@/components/articles/WriteArticleCtaButton';
import type { ArticleListItemDto, ArticleStatus } from '@shared/article';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

// Matches design/static_html/articles.html's `#anv-my-panel`/`.anv-status-badge` — own articles
// regardless of status, newest first (already the order GET /v1/articles/me returns), each with
// a pill badge overlaid on the cover image's top-left corner. 'draft'/'pending_review'/'rejected'
// are only ever visible here (and via direct link), never on the public Browse tab — see
// ArticlesService.findOne/listPublished. The prototype only modeled a generic/`.pending` badge;
// `draft`/`rejected` extend that same treatment with their own colors.
const STATUS_BADGE: Record<ArticleStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-ink-3' },
  pending_review: { label: 'Pending review', className: 'bg-[#B08A2E]' },
  published: { label: 'Published', className: 'bg-accent' },
  rejected: { label: 'Rejected', className: 'bg-error' },
};

export function MyArticlesPanel({ articles }: { articles: ArticleListItemDto[] }) {
  if (articles.length === 0) {
    return (
      <div className="mx-auto max-w-[420px] rounded-[18px] border border-dashed border-line-2 bg-bg-card px-8 py-12 text-center">
        <div className="mx-auto mb-[18px] flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-accent">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
        </div>
        <p className="mb-2 text-[17px] font-semibold text-ink">You haven&apos;t published anything yet</p>
        <p className="mb-[22px] text-[13.5px] leading-[1.55] text-ink-3">
          Write your first article and it&apos;ll show up here — including anything still waiting
          on editorial review.
        </p>
        <WriteArticleCtaButton />
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => {
        const badge = STATUS_BADGE[article.status];
        return (
          // A plain `<div>`, not `<Link>` — the edit button below is a sibling anchor, and
          // nesting an `<a>` inside another `<a>` is invalid HTML.
          <div
            key={article.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-bg-card transition-colors hover:border-line-2"
          >
            <Link href={`/articles/${article.id}`} className="flex flex-1 flex-col">
              <div className="relative">
                <span
                  className={`absolute left-3 top-3 z-[2] rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.05em] text-bg-card ${badge.className}`}
                >
                  {badge.label.toUpperCase()}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={article.coverImageUrl} alt="" className="h-[140px] w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <span className="mb-2 text-xs text-ink-3">
                  {DATE_FORMAT.format(new Date(article.createdAt)).toUpperCase()}
                </span>
                <h3 className="line-clamp-2 text-title text-ink">{article.title}</h3>
                {article.status === 'rejected' && article.rejectionReason && (
                  <p className="mt-2 text-xs text-error">{article.rejectionReason}</p>
                )}
              </div>
            </Link>
            <Link
              href={`/articles/write?edit=${article.id}`}
              aria-label="Edit article"
              title="Edit article"
              className="absolute right-3 top-3 z-[2] flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
