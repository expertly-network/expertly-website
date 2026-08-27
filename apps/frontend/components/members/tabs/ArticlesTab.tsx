'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getArticles } from '@/lib/api/articles';
import { ApiError } from '@/lib/api/client';
import type { ArticleListItemDto } from '@shared/article';

export function ArticlesTab({ authorId }: { authorId: string }) {
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
    return <p className="py-8 text-sm text-ink-3">No published articles yet.</p>;
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
