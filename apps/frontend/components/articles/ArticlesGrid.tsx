'use client';

import { useMemo, useState } from 'react';
import { Button, Card, FilterPopover } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { ArticleCard } from '@/components/articles/ArticleCard';
import type { ArticleListItemDto } from '@shared/article';
import type { PracticeAreaDto } from '@shared/practice-area';

// Client-side filtering over the full published set — matches design/static_html/articles.html's
// own behavior (it filters client-side too, not a paginated query), a reasonable fit given the
// dataset size (a handful of published articles, not thousands).
export function ArticlesGrid({
  articles,
  practiceAreas,
}: {
  articles: ArticleListItemDto[];
  practiceAreas: PracticeAreaDto[];
}) {
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [practiceAreaFilter, setPracticeAreaFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const matchesCountry = countryFilter.length === 0 || countryFilter.includes(a.country);
      const matchesPracticeArea =
        practiceAreaFilter.length === 0 ||
        a.practiceAreas.some((p) => practiceAreaFilter.includes(p.id));
      return matchesCountry && matchesPracticeArea;
    });
  }, [articles, countryFilter, practiceAreaFilter]);

  const hasFilters = countryFilter.length > 0 || practiceAreaFilter.length > 0;

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
          label="All categories"
          options={practiceAreas.map((p) => ({ value: p.id, label: p.name }))}
          selected={practiceAreaFilter}
          onChange={setPracticeAreaFilter}
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
                setPracticeAreaFilter([]);
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
