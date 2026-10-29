import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatAuthorDesignation } from '@/lib/articles/format';
import type { ArticleListItemDto } from '@shared/article';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

// Cover image, service badge, title, countries, then an author row with date + read time.
export function ArticleCard({ article }: { article: ArticleListItemDto }) {
  const primaryService = article.services[0];
  const designation = formatAuthorDesignation(article.authorHeadline, article.authorFirmName);

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-line bg-bg-card transition-colors hover:border-line-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src={article.coverImageUrl} alt="" className="h-[180px] w-full object-cover" />

      <div className="flex flex-1 flex-col p-5">
        {/* Service on its own line so a long name never wraps the badge onto two lines;
            countries sit under the title, date + read time move to the author row. */}
        {primaryService && (
          <div className="mb-3 flex min-w-0" title={primaryService.name}>
            <Badge variant="brand" className="max-w-full">
              <span className="truncate">{primaryService.name}</span>
            </Badge>
          </div>
        )}

        <h3 className="line-clamp-2 text-title text-ink">{article.title}</h3>

        {article.countries.length > 0 && (
          <div className="mt-2 flex min-w-0 items-center gap-1 text-xs text-ink-3">
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
            <span className="truncate" title={article.countries.join(', ')}>
              {article.countries.join(', ')}
            </span>
          </div>
        )}

        <div className="mt-auto flex items-center gap-2.5 pt-5">
          {article.authorPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async"
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
              <div className="truncate text-[10px] text-ink-4">{designation}</div>
            )}
          </div>
          <span className="ml-auto flex-none pl-2 text-right text-xs leading-tight text-ink-3">
            {DATE_FORMAT.format(new Date(article.createdAt))}
            <br />
            {article.readTimeMinutes} min read
          </span>
        </div>
      </div>
    </Link>
  );
}
