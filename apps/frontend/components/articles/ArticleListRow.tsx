import Image from 'next/image';
import Link from 'next/link';
import { formatArticleDate, formatReadTime } from '@/lib/articles/format';
import { mustHotlink } from '@/lib/images';
import type { ArticleListItemDto } from '@shared/article';

// Article row, news-app style: service label, headline, byline, and a cover on the right. Used by
// the home page's latest articles and the /articles list on phones. `detailed` is the member
// profile's Articles tab: no author in the byline (it is the author's own page), a two-line
// excerpt, and a larger cover from 640px.
export function ArticleListRow({ article: a, detailed = false }: { article: ArticleListItemDto; detailed?: boolean }) {
  return (
    <Link href={`/articles/${a.slug}`} className="flex items-start gap-4 py-4">
      <div className="min-w-0 flex-1">
        {/* Category on the left, read time on the right — the same top line in every article list. */}
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[11px] font-medium text-accent">{a.services[0]?.name ?? ''}</span>
          <span className="flex-none font-mono text-[11px] text-ink-3">{formatReadTime(a.readTimeMinutes)}</span>
        </div>
        <h3 className="mt-1 line-clamp-3 text-[15px] font-medium leading-snug text-ink">{a.title}</h3>
        {detailed && a.excerpt && (
          <p className="mt-1.5 hidden line-clamp-2 text-sm leading-relaxed text-ink-3 sm:block">{a.excerpt}</p>
        )}
        <div className="mt-2 truncate font-mono text-[11px] text-ink-3">
          {detailed ? '' : `${a.authorName} · `}
          {formatArticleDate(a.createdAt)}
        </div>
      </div>
      {a.coverImageUrl && (
        <div
          className={`relative h-[72px] w-[72px] flex-none overflow-hidden rounded-xl border border-line bg-bg-alt ${
            detailed ? 'sm:h-[88px] sm:w-[132px]' : ''
          }`}
        >
          <Image
            src={a.coverImageUrl}
            unoptimized={mustHotlink(a.coverImageUrl)}
            alt=""
            fill
            sizes={detailed ? '(min-width: 640px) 132px, 72px' : '72px'}
            className="object-cover"
          />
        </div>
      )}
    </Link>
  );
}
