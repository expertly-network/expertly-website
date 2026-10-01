'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getArticles } from '@/lib/api/articles';
import { ApiError } from '@/lib/api/client';
import { WriteArticleCtaButton } from '@/components/articles/WriteArticleCtaButton';
import type { ArticleListItemDto } from '@shared/article';

export function ArticlesTab({
  authorId,
  isOwnProfile,
}: {
  authorId: string;
  isOwnProfile: boolean;
}) {
  const [articles, setArticles] = useState<ArticleListItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getArticles({ authorId })
      .then((result) => {
        if (!cancelled) setArticles(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load articles.');
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
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-alt" />
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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
        </div>
        <p className="mb-2 text-[17px] font-semibold text-ink">You haven&apos;t published anything yet</p>
        <p className="mb-[22px] text-[13.5px] leading-[1.55] text-ink-3">
          Share your expertise with the community — write your first article and it&apos;ll show
          up here.
        </p>
        <WriteArticleCtaButton />
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {articles.map((article) => (
        <li key={article.id}>
          <Link
            href={`/articles/${article.id}`}
            className="block rounded-xl border border-line p-4 transition-colors hover:border-line-2"
          >
            <div className="font-medium text-ink">{article.title}</div>
            <p className="mt-1 text-sm text-ink-3">{article.excerpt}</p>
            <div className="mt-2 text-xs text-ink-3">{article.readTimeMinutes} min read</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
