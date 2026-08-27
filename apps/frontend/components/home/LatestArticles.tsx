import Link from 'next/link';
import { Card, Badge } from '@/components/ui';
import { formatArticleDate, formatReadTime, formatAuthorDesignation } from '@/lib/articles/format';
import type { ArticleListItemDto } from '@shared/article';

function AuthorAvatar({ article, size }: { article: ArticleListItemDto; size: 36 | 60 }) {
  const dimension = size === 60 ? 'h-[60px] w-[60px]' : 'h-9 w-9';
  const textSize = size === 60 ? 'text-lg' : 'text-sm';

  if (article.authorPhotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={article.authorPhotoUrl}
        alt=""
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

// Ported from design/static_html/assets/home.js's initLatestArticles + home.css's
// `.articles-grid`/`.article-img`/`.article-author` rules: first article featured large
// (1.3fr column, 360px-min-height image, 60px author avatar), next 4 as a 1fr list (36px
// avatars) — a deliberate 1.3:1 split, not an even 2-column grid, and a taller image than
// this app previously used. Data is the real GET /v1/articles (public, published-only,
// newest-first) — `authorName`/`authorPhotoUrl` are already denormalized on the DTO, no
// author lookup needed.
export function LatestArticles({ articles }: { articles: ArticleListItemDto[] }) {
  if (articles.length === 0) return null;
  const [featured, ...rest] = articles;
  const featuredDesignation = formatAuthorDesignation(featured.authorHeadline, featured.authorFirmName);

  return (
    <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
      <Link href={`/articles/${featured.id}`} className="flex flex-col gap-5">
        <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-2xl border border-line bg-bg-alt lg:min-h-[360px]">
          {featured.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={featured.coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          {featured.practiceAreas[0] && (
            <div className="absolute left-4 top-4">
              <Badge variant="emphasis">{featured.practiceAreas[0].name}</Badge>
            </div>
          )}
        </div>
        <div>
          <div className="font-mono text-[11px] tracking-[0.1em] text-ink-3">
            {formatArticleDate(featured.createdAt)} · {formatReadTime(featured.readTimeMinutes)}
          </div>
          <h3 className="mt-3.5 text-heading text-ink">{featured.title}</h3>
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
            <Link key={a.id} href={`/articles/${a.id}`} className="flex gap-4 py-4">
              <div className="font-mono text-sm text-ink-4">0{i + 2}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {a.practiceAreas[0] && <Badge variant="neutral">{a.practiceAreas[0].name}</Badge>}
                  <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3">
                    {formatReadTime(a.readTimeMinutes)} · {formatArticleDate(a.createdAt)}
                  </span>
                </div>
                <h4 className="mt-1.5 text-title text-ink">{a.title}</h4>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <AuthorAvatar article={a} size={36} />
                  <div className="leading-tight">
                    <div className="text-caption text-ink-2">{a.authorName}</div>
                    {designation && (
                      <div className="mt-0.5 font-mono text-[10px] text-ink-3">{designation}</div>
                    )}
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
