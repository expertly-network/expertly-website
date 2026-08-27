import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatAuthorDesignation } from '@/lib/articles/format';
import type { ArticleListItemDto } from '@shared/article';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

// Matches design/static_html/articles.html's `.anv-card` — whole card is one link, cover
// image, then a chip+country / date+read-time meta row, title, then an author row. No
// excerpt shown on the card by design (title + author block only) — only the detail page
// shows excerpt-length copy.
export function ArticleCard({ article }: { article: ArticleListItemDto }) {
  const primaryPracticeArea = article.practiceAreas[0];
  const designation = formatAuthorDesignation(article.authorHeadline, article.authorFirmName);

  return (
    <Link
      href={`/articles/${article.id}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-line bg-bg-card transition-colors hover:border-line-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={article.coverImageUrl} alt="" className="h-[180px] w-full object-cover" />

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {primaryPracticeArea && <Badge variant="brand">{primaryPracticeArea.name}</Badge>}
            <span className="truncate text-xs text-ink-3">{article.country}</span>
          </div>
          <span className="flex-none text-xs text-ink-3">
            {DATE_FORMAT.format(new Date(article.createdAt)).toUpperCase()} ·{' '}
            {article.readTimeMinutes} min
          </span>
        </div>

        <h3 className="line-clamp-2 text-title text-ink">{article.title}</h3>

        <div className="mt-auto flex items-center gap-2.5 pt-5">
          {article.authorPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.authorPhotoUrl}
              alt=""
              className="h-8 w-8 flex-none rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-bg-alt text-xs font-semibold text-ink-4">
              {article.authorName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-ink-2">{article.authorName}</div>
            {designation && (
              <div className="truncate text-[10px] tracking-wide text-ink-4">{designation}</div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
