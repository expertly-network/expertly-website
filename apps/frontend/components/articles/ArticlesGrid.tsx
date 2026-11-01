'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, FilterPopover, Pagination } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { ArticleCard } from '@/components/articles/ArticleCard';
import { getArticles } from '@/lib/api/articles';
import { ARTICLES_PAGE_SIZE } from '@/lib/api/articles-query';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import type { ArticleListItemDto } from '@shared/article';
import type { CategoryDto } from '@shared/category';

type Status = 'idle' | 'filtering' | 'paging';

// Server-paged: the first page arrives from the server component; changing a filter refetches
// page 1, and the page bar under the grid swaps in another page of ARTICLES_PAGE_SIZE. Filtering
// happens in the API, not here — the browser only ever holds the page it is showing.
export function ArticlesGrid({
  initialArticles,
  initialTotal,
  categories,
  initialServiceFilter = [],
}: {
  initialArticles: ArticleListItemDto[];
  initialTotal: number;
  categories: CategoryDto[];
  /** Service ids the server-rendered first page is already filtered by. */
  initialServiceFilter?: string[];
}) {
  const [lineFilter, setLineFilter] = useState<string[]>([]);
  // Service lines (Tax, Finance, Legal, …) in taxonomy order; services narrowed to the chosen lines.
  const lineOptions = [...new Map(categories.map((c) => [c.serviceLineId, c.serviceLineName]))].map(
    ([value, label]) => ({ value, label })
  );
  const services = categories
    .filter((c) => lineFilter.length === 0 || lineFilter.includes(c.serviceLineId))
    .flatMap((c) => c.services);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState<string[]>(initialServiceFilter);
  const [articles, setArticles] = useState(initialArticles);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status>('idle');
  // The request that failed, so "Try again" repeats exactly that one.
  const [failed, setFailed] = useState<{ page: number; mode: Exclude<Status, 'idle'>; message: string } | null>(null);
  // Only the latest request may write state — a slow earlier response must not overwrite it.
  const requestId = useRef(0);
  const isFirstRender = useRef(true);
  const topRef = useRef<HTMLDivElement>(null);

  async function load(nextPage: number, mode: Exclude<Status, 'idle'>) {
    const id = ++requestId.current;
    setStatus(mode);
    setFailed(null);
    try {
      const result = await getArticles({
        serviceId: serviceFilter,
        serviceLineId: lineFilter,
        country: countryFilter,
        page: nextPage,
        pageSize: ARTICLES_PAGE_SIZE,
      });
      if (id !== requestId.current) return;
      setArticles(result.items);
      setTotal(result.total);
      setPage(nextPage);
    } catch (err) {
      if (id !== requestId.current) return;
      // A failed filter change mustn't leave the previous filter's results on screen.
      if (mode === 'filtering') {
        setArticles([]);
        setTotal(0);
      }
      setFailed({ page: nextPage, mode, message: apiErrorMessage(err, 'Failed to load articles.') });
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
  }, [countryFilter, serviceFilter, lineFilter]);

  const hasFilters = countryFilter.length > 0 || serviceFilter.length > 0 || lineFilter.length > 0;
  const totalPages = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE));

  function goToPage(nextPage: number) {
    void load(nextPage, 'paging');
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Shown where the failure happened: above the grid for a filter change, below it for a page change.
  const retryCard = failed && (
    <Card padding="md" className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-3">Couldn&apos;t load articles. {failed.message}</p>
      <Button variant="secondary" size="sm" onClick={() => void load(failed.page, failed.mode)}>
        Try again
      </Button>
    </Card>
  );

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className="flex flex-wrap gap-2.5">
        <FilterPopover
          label="All areas"
          options={lineOptions}
          selected={lineFilter}
          onChange={(values) => {
            setLineFilter(values);
            // Keep only services that still belong to the chosen areas.
            const allowed = new Set(
              categories
                .filter((c) => values.length === 0 || values.includes(c.serviceLineId))
                .flatMap((c) => c.services.map((sv) => sv.id))
            );
            setServiceFilter((prev) => prev.filter((id) => allowed.has(id)));
          }}
        />
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
          : failed?.mode === 'filtering'
            ? '\u00a0'
            : `${total} article${total === 1 ? '' : 's'}${totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}`}
      </p>

      {failed?.mode === 'filtering' && status === 'idle' && retryCard}

      {articles.length > 0 ? (
        <>
          <div
            className={`mt-5 grid gap-6 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${
              status !== 'idle' ? 'pointer-events-none opacity-50' : ''
            }`}
            aria-busy={status !== 'idle'}
          >
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {failed?.mode === 'paging' && status === 'idle' && retryCard}
          <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} className="mt-10" />
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
                  setLineFilter([]);
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
