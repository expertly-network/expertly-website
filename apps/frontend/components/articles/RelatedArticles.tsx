import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui';
import type { ArticleListItemDto } from '@shared/article';
import { mustHotlink } from '@/lib/images';
import { formatDate } from '@/lib/dates';

// Same service first, backfilled with other published articles, capped at 4. The page passes an
// already-picked handful (see loadRelated in articles/[slug]/page.tsx), not the full list.
export function RelatedArticles({
  current,
  articles,
}: {
  current: ArticleListItemDto;
  articles: ArticleListItemDto[];
}) {
  const currentServiceIds = new Set(current.services.map((s) => s.id));
  const others = articles.filter((a) => a.id !== current.id);
  const sameService = others.filter((a) => a.services.some((s) => currentServiceIds.has(s.id)));
  const rest = others.filter((a) => !sameService.includes(a));
  const related = [...sameService, ...rest].slice(0, 4);

  if (related.length === 0) return null;

  const label = current.services[0]?.name;

  return (
    <Card padding="md">
      <div className="mb-3 text-mono-label text-ink-3">{label ? `More in ${label}` : 'More articles'}</div>
      <ul className="flex flex-col gap-3">
        {related.map((article) => (
          <li key={article.id}>
            <Link href={`/articles/${article.slug}`} className="flex gap-3">
              <Image
                src={article.coverImageUrl}
                unoptimized={mustHotlink(article.coverImageUrl)}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 flex-none rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium text-ink">{article.title}</p>
                <p className="mt-1 text-xs text-ink-3">
                  {formatDate(new Date(article.createdAt))} · {article.readTimeMinutes} min
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
