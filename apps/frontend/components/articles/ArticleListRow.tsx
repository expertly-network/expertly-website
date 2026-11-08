import Image from 'next/image';
import Link from 'next/link';
import { formatArticleDate, formatReadTime } from '@/lib/articles/format';
import { mustHotlink } from '@/lib/images';
import type { ArticleListItemDto } from '@shared/article';

// Phone-width article row, news-app style: service label, headline, byline, and a small cover on
// the right. Used by the home page's latest articles and the /articles list on phones.
export function ArticleListRow({ article: a }: { article: ArticleListItemDto }) {
  return (
    <Link href={`/articles/${a.slug}`} className="flex items-start gap-4 py-4">
      <div className="min-w-0 flex-1">
        {a.services[0] && <div className="truncate text-[11px] font-medium text-accent">{a.services[0].name}</div>}
        <h3 className="mt-1 line-clamp-3 text-[15px] font-medium leading-snug text-ink">{a.title}</h3>
        <div className="mt-2 truncate font-mono text-[11px] text-ink-3">
          {a.authorName} · {formatArticleDate(a.createdAt)} · {formatReadTime(a.readTimeMinutes)}
        </div>
      </div>
      {a.coverImageUrl && (
        <div className="relative h-[72px] w-[72px] flex-none overflow-hidden rounded-xl border border-line bg-bg-alt">
          <Image
            src={a.coverImageUrl}
            unoptimized={mustHotlink(a.coverImageUrl)}
            alt=""
            fill
            sizes="72px"
            className="object-cover"
          />
        </div>
      )}
    </Link>
  );
}
