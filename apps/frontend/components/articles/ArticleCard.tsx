import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatAuthorDesignation } from '@/lib/articles/format';
import type { ArticleListItemDto } from '@shared/article';
import { mustHotlink } from '@/lib/images';
import { formatDate } from '@/lib/dates';
import { ArticleCountries } from '@/components/articles/ArticleCountries';

// Cover image, service label, title, countries, then an author row with date + read time.
// The title's link stretches over the whole card; the service label is a separate link (above
// the overlay) to the articles list filtered to that service.
export function ArticleCard({ article }: { article: ArticleListItemDto }) {
  const primaryService = article.services[0];
  const designation = formatAuthorDesignation(article.authorHeadline, article.authorFirmName);

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-bg-card transition-colors hover:border-line-2">
      <div className="relative h-[180px] w-full bg-bg-alt">
        <Image
          src={article.coverImageUrl}
          unoptimized={mustHotlink(article.coverImageUrl)}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* Service on its own line so a long name never wraps the badge onto two lines;
            countries sit under the title, date + read time move to the author row. */}
        {primaryService && (
          <div className="mb-3 flex min-w-0" title={`More articles on ${primaryService.name}`}>
            <Link
              href={`/articles?service=${encodeURIComponent(primaryService.id)}`}
              className="relative z-10 max-w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Badge variant="brand" className="max-w-full transition-opacity hover:opacity-80">
                <span className="truncate">{primaryService.name}</span>
              </Badge>
            </Link>
          </div>
        )}

        <h3 className="line-clamp-2 text-title text-ink">
          <Link
            href={`/articles/${article.slug}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:underline focus-visible:outline-none"
          >
            {article.title}
          </Link>
        </h3>

        <ArticleCountries countries={article.countries} className="mt-2" />

        <div className="mt-auto flex items-center gap-2.5 pt-5">
          {article.authorPhotoUrl ? (
            <Image
              src={article.authorPhotoUrl}
              alt=""
              width={32}
              height={32}
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
            {designation && <div className="truncate text-[10px] text-ink-4">{designation}</div>}
          </div>
          <span className="ml-auto flex-none pl-2 text-right text-xs leading-tight text-ink-3">
            {formatDate(new Date(article.createdAt))}
            <br />
            {article.readTimeMinutes} min read
          </span>
        </div>
      </div>
    </article>
  );
}
