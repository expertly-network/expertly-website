import Link from 'next/link';
import { Card } from '@/components/ui';
import type { ArticleListItemDto } from '@shared/article';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

// Matches design/static_html/article.html's "More in {category}" sidebar list — same
// practice area first, backfilled with other published articles, capped at 4.
export function RelatedArticles({
  current,
  articles,
}: {
  current: ArticleListItemDto;
  articles: ArticleListItemDto[];
}) {
  const currentAreaIds = new Set(current.practiceAreas.map((p) => p.id));
  const others = articles.filter((a) => a.id !== current.id);
  const sameArea = others.filter((a) => a.practiceAreas.some((p) => currentAreaIds.has(p.id)));
  const rest = others.filter((a) => !sameArea.includes(a));
  const related = [...sameArea, ...rest].slice(0, 4);

  if (related.length === 0) return null;

  const label = current.practiceAreas[0]?.name;

  return (
    <Card padding="md">
      <div className="mb-3 text-mono-label text-ink-3">
        {label ? `More in ${label}` : 'More articles'}
      </div>
      <ul className="flex flex-col gap-3">
        {related.map((article) => (
          <li key={article.id}>
            <Link href={`/articles/${article.id}`} className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.coverImageUrl}
                alt=""
                className="h-14 w-14 flex-none rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium text-ink">{article.title}</p>
                <p className="mt-1 text-xs text-ink-3">
                  {DATE_FORMAT.format(new Date(article.createdAt)).toUpperCase()} ·{' '}
                  {article.readTimeMinutes} min
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
