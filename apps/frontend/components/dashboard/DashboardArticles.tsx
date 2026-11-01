'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ArticleListItemDto } from '@shared/article';
import { ArticleCard } from '@/components/articles/ArticleCard';

type Tab = 'latest' | 'mine';

// dashboard.html's "Articles" block: Latest / My Articles tabs, "Write an article", "See all", and
// three of the articles page's own cards (cover image, author photo and details). The prototype's
// "Most Viewed" tab and view counts need view tracking, which the backend doesn't record yet.
export function DashboardArticles({
  latest,
  mine,
  latestError,
}: {
  latest: ArticleListItemDto[];
  mine: ArticleListItemDto[] | null;
  latestError: boolean;
}) {
  const [tab, setTab] = useState<Tab>('latest');
  const items = (tab === 'latest' ? latest : (mine ?? [])).slice(0, 3);
  const empty =
    tab === 'latest'
      ? latestError
        ? 'Articles are temporarily unavailable. Refresh to try again.'
        : 'No articles yet.'
      : mine === null
        ? 'Your articles are temporarily unavailable. Refresh to try again.'
        : 'You haven’t written an article yet. Share your first one with the community.';

  return (
    <section aria-label="Articles">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title text-ink">Articles</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Articles" className="flex items-center gap-1">
            {(
              [
                ['latest', 'Latest'],
                ['mine', 'My Articles'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${tab === value ? 'bg-ink text-bg' : 'text-ink-3 hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Link
            href="/articles/write"
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-neon/60 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            Write an article
          </Link>
          <Link
            href={tab === 'mine' ? '/articles?tab=mine' : '/articles'}
            className="px-2 text-sm font-medium text-accent hover:underline"
          >
            See all <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-card border border-line bg-bg-card px-6 py-10 text-center text-sm text-ink-3">{empty}</p>
      ) : (
        // Two across leaves the third card on its own row, so it shows only at three columns.
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-lg:[&>*:nth-child(3)]:hidden">
          {items.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </section>
  );
}
