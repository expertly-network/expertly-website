'use client';

import { useMemo, useState } from 'react';
import { Button, Card, FilterPopover } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { ArticleCard } from '@/components/articles/ArticleCard';
import type { ArticleListItemDto } from '@shared/article';
import type { CategoryDto } from '@shared/category';

// Client-side filtering over the full published set.
export function ArticlesGrid({
  articles,
  categories,
}: {
  articles: ArticleListItemDto[];
  categories: CategoryDto[];
}) {
  const services = categories.flatMap((c) => c.services);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const matchesCountry =
        countryFilter.length === 0 || a.countries.some((c) => countryFilter.includes(c));
      const matchesService =
        serviceFilter.length === 0 || a.services.some((s) => serviceFilter.includes(s.id));
      return matchesCountry && matchesService;
    });
  }, [articles, countryFilter, serviceFilter]);

  const hasFilters = countryFilter.length > 0 || serviceFilter.length > 0;

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

      <p className="mt-6 font-mono text-xs tracking-[0.04em] text-ink-3">
        {filtered.length} article{filtered.length === 1 ? '' : 's'}
      </p>

      {filtered.length > 0 ? (
        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <Card padding="lg" className="mt-5 flex flex-col items-center gap-3 text-center">
          <p className="font-mono text-xs tracking-[0.04em] text-ink-3">No results</p>
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
      )}
    </div>
  );
}
