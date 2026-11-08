'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, FilterPopover, MobileFilterBar, Pagination, type FilterChip } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { ArticleCard } from '@/components/articles/ArticleCard';
import { ArticleListRow } from '@/components/articles/ArticleListRow';
import { ArticleFiltersSheet, articleServiceIds } from '@/components/articles/ArticleFiltersSheet';
import { getArticles } from '@/lib/api/articles';
import { ARTICLES_PAGE_SIZE } from '@/lib/api/articles-query';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import type { ArticleListItemDto } from '@shared/article';
import type { CategoryDto } from '@shared/category';

type Status = 'idle' | 'filtering' | 'paging' | 'more';

// Server-paged: the first page arrives from the server component; changing a filter refetches
// page 1. Filtering happens in the API, not here.
// Larger screens: three filter dropdowns, a card grid, and a page bar that swaps in another page.
// Phones: a sticky "Filters" bar opening a bottom sheet, removable filter chips, the first article
// as a card and the rest as compact rows, and "Load more" appending the next page.
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
  // Categories, then services narrowed to the chosen categories — the same two levels the members
  // directory filters by.
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const services = categories
    .filter((c) => categoryFilter.length === 0 || categoryFilter.includes(c.id))
    .flatMap((c) => c.services);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState<string[]>(initialServiceFilter);
  const [articles, setArticles] = useState(initialArticles);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status>('idle');
  const [sheetOpen, setSheetOpen] = useState(false);
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
      // Chosen services win; otherwise a category filter means "any service in those categories".
      const serviceIds = articleServiceIds(
        { countries: countryFilter, categories: categoryFilter, services: serviceFilter },
        categories
      );
      const result = await getArticles({
        serviceId: serviceIds,
        country: countryFilter,
        page: nextPage,
        pageSize: ARTICLES_PAGE_SIZE,
      });
      if (id !== requestId.current) return;
      setArticles((prev) => (mode === 'more' ? [...prev, ...result.items] : result.items));
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
  }, [countryFilter, serviceFilter, categoryFilter]);

  const activeCount = countryFilter.length + serviceFilter.length + categoryFilter.length;
  const hasFilters = activeCount > 0;
  const countText =
    status === 'filtering'
      ? 'Loading…'
      : failed?.mode === 'filtering'
        ? '\u00a0'
        : `${total} article${total === 1 ? '' : 's'}`;
  // Removable chips for the phone bar, one per active filter value.
  const chips: FilterChip[] = [
    ...countryFilter.map((c) => ({
      key: `country-${c}`,
      label: c,
      onRemove: () => setCountryFilter((prev) => prev.filter((v) => v !== c)),
    })),
    ...categoryFilter.map((id) => ({
      key: `category-${id}`,
      label: categories.find((c) => c.id === id)?.name ?? id,
      onRemove: () =>
        applyFilters({
          countries: countryFilter,
          categories: categoryFilter.filter((v) => v !== id),
          services: serviceFilter,
        }),
    })),
    ...serviceFilter.map((id) => ({
      key: `service-${id}`,
      label: categories.flatMap((c) => c.services).find((sv) => sv.id === id)?.name ?? id,
      onRemove: () => setServiceFilter((prev) => prev.filter((v) => v !== id)),
    })),
  ];

  function applyFilters(next: { countries: string[]; categories: string[]; services: string[] }) {
    // Keep only services that still belong to the chosen categories.
    const allowed = new Set(
      categories
        .filter((c) => next.categories.length === 0 || next.categories.includes(c.id))
        .flatMap((c) => c.services.map((sv) => sv.id))
    );
    setCountryFilter(next.countries);
    setCategoryFilter(next.categories);
    setServiceFilter(next.services.filter((id) => allowed.has(id)));
  }
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
      {/* Phones: Filters button + count (sticky) and removable chips; larger screens use the dropdowns below. */}
      <MobileFilterBar
        activeCount={activeCount}
        countLabel={countText}
        onOpen={() => setSheetOpen(true)}
        chips={chips}
      />
      {sheetOpen && (
        <ArticleFiltersSheet
          categories={categories}
          value={{ countries: countryFilter, categories: categoryFilter, services: serviceFilter }}
          onApply={(next) => {
            applyFilters(next);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}

      <div className="hidden flex-wrap gap-2.5 sm:flex">
        <FilterPopover
          label="All countries"
          options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
          selected={countryFilter}
          onChange={setCountryFilter}
        />
        <FilterPopover
          label="All categories"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          selected={categoryFilter}
          onChange={(values) => applyFilters({ countries: countryFilter, categories: values, services: serviceFilter })}
        />
        <FilterPopover
          label="All services"
          options={services.map((s) => ({ value: s.id, label: s.name }))}
          selected={serviceFilter}
          onChange={setServiceFilter}
        />
      </div>

      <p className="mt-6 hidden font-mono text-xs text-ink-3 sm:block" aria-live="polite">
        {countText}
        {status !== 'filtering' && !failed && totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
      </p>

      {failed?.mode === 'filtering' && status === 'idle' && retryCard}

      {articles.length > 0 ? (
        <>
          {/* Phones: the first article as a card, the rest as compact rows, then "Load more". */}
          <div
            className={`mt-4 transition-opacity sm:hidden ${status === 'filtering' ? 'pointer-events-none opacity-50' : ''}`}
            aria-busy={status === 'filtering'}
          >
            <ArticleCard article={articles[0]} />
            {articles.length > 1 && (
              <ul className="mt-2 divide-y divide-line">
                {articles.slice(1).map((article) => (
                  <li key={article.id}>
                    <ArticleListRow article={article} />
                  </li>
                ))}
              </ul>
            )}
            {failed?.mode === 'more' && status === 'idle' && retryCard}
            {articles.length < total && (
              <Button
                variant="secondary"
                fullWidth
                className="mt-4"
                disabled={status !== 'idle'}
                onClick={() => void load(page + 1, 'more')}
              >
                {status === 'more' ? 'Loading…' : 'Load more articles'}
              </Button>
            )}
          </div>

          <div
            className={`mt-5 hidden gap-6 transition-opacity sm:grid sm:grid-cols-2 lg:grid-cols-3 ${
              status !== 'idle' ? 'pointer-events-none opacity-50' : ''
            }`}
            aria-busy={status !== 'idle'}
          >
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          <div className="hidden sm:block">
            {failed?.mode === 'paging' && status === 'idle' && retryCard}
            <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} className="mt-10" />
          </div>
        </>
      ) : status === 'filtering' ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-bg-alt sm:h-[330px]" />
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
                  setCategoryFilter([]);
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
