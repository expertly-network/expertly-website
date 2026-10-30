'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, FilterPopover } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { ArticleCard } from '@/components/articles/ArticleCard';
import { getArticles } from '@/lib/api/articles';
import { ARTICLES_PAGE_SIZE } from '@/lib/api/articles-query';
import { ApiError } from '@/lib/api/client';
import type { ArticleListItemDto } from '@shared/article';
import type { CategoryDto } from '@shared/category';

type Status = 'idle' | 'filtering' | 'loading-more';

// Server-paged: the first page arrives from the server component; changing a filter refetches
// page 1, and scrolling near the end of the grid appends the next page (infinite scroll, same
// pattern as MemberDirectoryList). Filtering happens in the API, not here — the
// browser only ever holds the pages it has shown.
export function ArticlesGrid({
  initialArticles,
  initialTotal,
  categories,
}: {
  initialArticles: ArticleListItemDto[];
  initialTotal: number;
  categories: CategoryDto[];
}) {
  const services = categories.flatMap((c) => c.services);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);
  const [articles, setArticles] = useState(initialArticles);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status>('idle');
  // The request that failed, so "Try again" repeats exactly that one.
  const [failed, setFailed] = useState<{ page: number; mode: Exclude<Status, 'idle'>; message: string } | null>(null);
  // Only the latest request may write state — a slow earlier response must not overwrite it.
  const requestId = useRef(0);
  const isFirstRender = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  async function load(nextPage: number, mode: Exclude<Status, 'idle'>) {
    const id = ++requestId.current;
    setStatus(mode);
    setFailed(null);
    try {
      const result = await getArticles({
        serviceId: serviceFilter,
        country: countryFilter,
        page: nextPage,
        pageSize: ARTICLES_PAGE_SIZE,
      });
      if (id !== requestId.current) return;
      setArticles((prev) => (nextPage === 1 ? result.items : [...prev, ...result.items]));
      setTotal(result.total);
      setPage(nextPage);
    } catch (err) {
      if (id !== requestId.current) return;
      // A failed filter change mustn't leave the previous filter's results on screen.
      if (nextPage === 1) {
        setArticles([]);
        setTotal(0);
      }
      setFailed({ page: nextPage, mode, message: err instanceof ApiError ? err.message : 'Failed to load articles.' });
    } finally {
      if (id === requestId.current) setStatus('idle');
    }
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void load(1, 'filtering');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the filters change
  }, [countryFilter, serviceFilter]);

  const hasFilters = countryFilter.length > 0 || serviceFilter.length > 0;
  const hasMore = articles.length < total;

  // Starts the next page ~400px before the end of the grid comes into view. Paused while a request
  // is in flight or after a failure (the "Try again" button resumes), so an error can't loop.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || status !== 'idle' || failed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load(page + 1, 'loading-more');
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load() reads the current filters
  }, [hasMore, status, failed, page, countryFilter, serviceFilter]);

  // Shown where the failure happened: above the grid for a filter change, below it for a next page.
  const retryCard = failed && (
    <Card padding="md" className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-3">Couldn&apos;t load articles. {failed.message}</p>
      <Button variant="secondary" size="sm" onClick={() => void load(failed.page, failed.mode)}>
        Try again
      </Button>
    </Card>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        <FilterPopover
          label="All countries"
          options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
          selected={countryFilter}
          onChange={setCountryFilter}
        />
        <FilterPopover
          label="All services"
          options={services.map((s) => ({ value: s.id, label: s.name }))}
          selected={serviceFilter}
          onChange={setServiceFilter}
        />
      </div>

      <p className="mt-6 font-mono text-xs text-ink-3" aria-live="polite">
        {status === 'filtering'
          ? 'Loading…'
          : failed?.page === 1
            ? '\u00a0'
            : `${total} article${total === 1 ? '' : 's'}`}
      </p>

      {failed?.mode === 'filtering' && status === 'idle' && retryCard}

      {articles.length > 0 ? (
        <>
          <div
            className={`mt-5 grid gap-6 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${
              status === 'filtering' ? 'pointer-events-none opacity-50' : ''
            }`}
            aria-busy={status !== 'idle'}
          >
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
            {status === 'loading-more' &&
              Array.from({ length: Math.min(ARTICLES_PAGE_SIZE, total - articles.length) }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="h-[330px] animate-pulse rounded-2xl border border-line bg-bg-alt"
                />
              ))}
          </div>

          {failed?.mode === 'loading-more' && status === 'idle' && retryCard}
          <div ref={sentinelRef} aria-hidden="true" className="h-px" />
        </>
      ) : status === 'filtering' ? (
        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[330px] animate-pulse rounded-2xl border border-line bg-bg-alt" />
          ))}
        </div>
      ) : (
        !failed && (
          <Card padding="lg" className="mt-5 flex flex-col items-center gap-3 text-center">
            <p className="font-mono text-xs text-ink-3">No results</p>
            <p className="text-sm text-ink-3">No articles in this category yet.</p>
            {hasFilters && (
              <Button
                variant="secondary"
                onClick={() => {
                  setCountryFilter([]);
                  setServiceFilter([]);
                }}
              >
                View all
              </Button>
            )}
          </Card>
        )
      )}
    </div>
  );
}
