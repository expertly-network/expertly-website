'use client';

import { useEffect, useState } from 'react';
import { getArticles } from '@/lib/api/articles';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import { ArticleListRow } from '@/components/articles/ArticleListRow';
import { WriteArticleCtaButton } from '@/components/articles/WriteArticleCtaButton';
import type { ArticleListItemDto } from '@shared/article';

export function ArticlesTab({ authorId, isOwnProfile }: { authorId: string; isOwnProfile: boolean }) {
  const [articles, setArticles] = useState<ArticleListItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getArticles({ authorId })
      .then((result) => {
        if (!cancelled) setArticles(result.items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(apiErrorMessage(err, 'Failed to load articles.'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authorId]);

  if (error) {
    return <p className="py-8 text-sm text-ink-3">Couldn&apos;t load articles right now.</p>;
  }

  if (articles === null) {
    return (
      <div className="divide-y divide-line border-y border-line">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex animate-pulse items-start gap-4 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-bg-alt" />
              <div className="h-4 w-3/4 rounded bg-bg-alt" />
              <div className="h-3 w-1/2 rounded bg-bg-alt" />
            </div>
            <div className="h-[72px] w-[72px] flex-none rounded-xl bg-bg-alt sm:h-[88px] sm:w-[132px]" />
          </div>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    if (!isOwnProfile) {
      return <p className="py-8 text-sm text-ink-3">No published articles yet.</p>;
    }
    return (
      <div className="mx-auto max-w-[420px] py-4 text-center">
        <div className="mx-auto mb-[18px] flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-accent">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
        </div>
        <p className="mb-2 text-[17px] font-semibold text-ink">You haven&apos;t published anything yet</p>
        <p className="mb-[22px] text-[13.5px] leading-[1.55] text-ink-3">
          Share your expertise with the community — write your first article and it&apos;ll show up here.
        </p>
        <WriteArticleCtaButton />
      </div>
    );
  }

  // A plain divided list (no boxes) with the cover on the right.
  return (
    <ul className="divide-y divide-line border-y border-line">
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleListRow article={article} detailed />
        </li>
      ))}
    </ul>
  );
}
