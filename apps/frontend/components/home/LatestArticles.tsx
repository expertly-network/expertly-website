import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatArticleDate, formatReadTime, formatAuthorDesignation } from '@/lib/articles/format';
import type { ArticleListItemDto } from '@shared/article';
import { mustHotlink } from '@/lib/images';
import { ArticleCountries } from '@/components/articles/ArticleCountries';

function AuthorAvatar({ article, size }: { article: ArticleListItemDto; size: 36 | 60 }) {
  const dimension = size === 60 ? 'h-[60px] w-[60px]' : 'h-9 w-9';
  const textSize = size === 60 ? 'text-lg' : 'text-sm';

  if (article.authorPhotoUrl) {
    return (
      <Image
        src={article.authorPhotoUrl}
        alt=""
        width={size}
        height={size}
        className={`${dimension} flex-none rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`flex ${dimension} flex-none items-center justify-center rounded-full bg-bg-alt ${textSize} font-medium text-ink-2`}
    >
      {article.authorName.charAt(0)}
    </div>
  );
}

// First article featured large, the rest in a compact list.
export function LatestArticles({ articles }: { articles: ArticleListItemDto[] }) {
  if (articles.length === 0) return null;
  const [featured, ...rest] = articles;
  const featuredDesignation = formatAuthorDesignation(featured.authorHeadline, featured.authorFirmName);

  return (
    <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
      <Link href={`/articles/${featured.slug}`} className="flex flex-col gap-5">
        <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-2xl border border-line bg-bg-alt lg:min-h-[360px]">
          {featured.coverImageUrl ? (
            <Image
              src={featured.coverImageUrl}
              unoptimized={mustHotlink(featured.coverImageUrl)}
              alt=""
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
            />
          ) : null}
          {featured.services[0] && (
            <div className="absolute left-4 top-4">
              <Badge variant="emphasis">{featured.services[0].name}</Badge>
            </div>
          )}
        </div>
        <div>
          <div className="font-mono text-[11px] text-ink-3">
            {formatArticleDate(featured.createdAt)} · {formatReadTime(featured.readTimeMinutes)}
          </div>
          <h3 className="mt-3.5 text-heading text-ink">{featured.title}</h3>
          <ArticleCountries countries={featured.countries} className="mt-2.5" />
          <div className="mt-5 flex items-center gap-3">
            <AuthorAvatar article={featured} size={60} />
            <div>
              <div className="text-sm font-medium text-ink">{featured.authorName}</div>
              {featuredDesignation && (
                <div className="mt-0.5 font-mono text-[11px] text-ink-3">{featuredDesignation}</div>
              )}
            </div>
          </div>
        </div>
      </Link>

      <div className="flex flex-col divide-y divide-line">
        {rest.map((a, i) => {
          const designation = formatAuthorDesignation(a.authorHeadline, a.authorFirmName);
          return (
            <Link key={a.id} href={`/articles/${a.slug}`} className="flex gap-4 py-4">
              <div className="font-mono text-sm text-ink-4">0{i + 2}</div>
              <div className="min-w-0 flex-1">
                <h4 className="text-title text-ink">{a.title}</h4>
                <ArticleCountries countries={a.countries} className="mt-1.5" />
                {/* Author on the left, date and read time in the row's otherwise empty right side. */}
                <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4 gap-y-1.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AuthorAvatar article={a} size={36} />
                    <div className="min-w-0 leading-tight">
                      <div className="text-caption text-ink-2">{a.authorName}</div>
                      {designation && <div className="mt-0.5 font-mono text-[10px] text-ink-3">{designation}</div>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[11px] leading-[1.5] text-ink-3">
                    <div>{formatArticleDate(a.createdAt)}</div>
                    <div>{formatReadTime(a.readTimeMinutes)}</div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
