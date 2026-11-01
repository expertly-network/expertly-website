import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ArticleListItemDto } from '@shared/article';
import { ArticleCountries } from '@/components/articles/ArticleCountries';
import { formatAuthorDesignation } from '@/lib/articles/format';
import { formatDate } from '@/lib/dates';
import { mustHotlink } from '@/lib/images';

// The line under an article's title: date · read time · countries, with `actions` (Edit, Share) on
// the right. `showAuthor` adds the author's photo, name and designation in front — for the
// signed-out preview, which has no "About the author" sidebar; the full article leaves it out
// because that sidebar already shows the author.
export function ArticleByline({
  article,
  actions,
  showAuthor = false,
}: {
  article: ArticleListItemDto;
  actions?: ReactNode;
  showAuthor?: boolean;
}) {
  const designation = formatAuthorDesignation(article.authorHeadline, article.authorFirmName);
  const meta = (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-3 ${showAuthor ? 'mt-1' : ''}`}>
      <time dateTime={article.createdAt}>{formatDate(new Date(article.createdAt))}</time>
      <span aria-hidden="true" className="text-ink-4">
        ·
      </span>
      <span>{article.readTimeMinutes} min read</span>
      {article.countries.length > 0 && (
        // Separator and countries wrap together, so a line never ends on a lone "·".
        <span className="flex min-w-0 items-center gap-x-2">
          <span aria-hidden="true" className="text-ink-4">
            ·
          </span>
          <ArticleCountries countries={article.countries} className="text-caption" />
        </span>
      )}
    </div>
  );
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-line pb-5">
      {showAuthor ? (
        <div className="flex min-w-0 items-center gap-3.5">
          {article.authorPhotoUrl ? (
            <Image
              src={article.authorPhotoUrl}
              unoptimized={mustHotlink(article.authorPhotoUrl)}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 flex-none rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-bg-alt text-sm font-semibold text-ink-4">
              {article.authorName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </span>
          )}
          <div className="min-w-0">
            {article.authorSlug ? (
              <Link
                href={`/members/${article.authorSlug}`}
                className="text-[15px] font-semibold text-ink hover:text-accent"
              >
                {article.authorName}
              </Link>
            ) : (
              <span className="text-[15px] font-semibold text-ink">{article.authorName}</span>
            )}
            {designation && <p className="truncate text-caption text-ink-3">{designation}</p>}
            {meta}
          </div>
        </div>
      ) : (
        meta
      )}
      {actions && <div className="flex flex-none items-center gap-3">{actions}</div>}
    </div>
  );
}
