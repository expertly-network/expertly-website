'use client';

import { useMemo, useState } from 'react';
import { useLiveCount } from '@/lib/hooks/useLiveCount';
import { FilterSheet, FilterSheetOptions, FilterSheetSearch, FilterSheetSection } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { getArticles } from '@/lib/api/articles';
import type { CategoryDto } from '@shared/category';

export interface ArticleFilters {
  countries: string[];
  categories: string[];
  services: string[];
}

/** Service ids to query: chosen services win, otherwise every service in the chosen categories. */
export function articleServiceIds(filters: ArticleFilters, categories: CategoryDto[]): string[] {
  if (filters.services.length > 0) return filters.services;
  if (filters.categories.length === 0) return [];
  return categories.filter((c) => filters.categories.includes(c.id)).flatMap((c) => c.services.map((s) => s.id));
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Phone filter sheet for the articles list (built on ui/FilterSheet): the visitor ticks options in
// collapsible sections, sees a live result count, and applies everything at once with
// "Show N articles". Nothing changes on the page until then.
export function ArticleFiltersSheet({
  categories,
  value,
  onApply,
  onClose,
}: {
  categories: CategoryDto[];
  value: ArticleFilters;
  onApply: (next: ArticleFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ArticleFilters>(value);
  const [countryQuery, setCountryQuery] = useState('');

  const services = useMemo(
    () =>
      categories
        .filter((c) => draft.categories.length === 0 || draft.categories.includes(c.id))
        .flatMap((c) => c.services),
    [categories, draft.categories]
  );
  const countries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    return q ? ALL_COUNTRIES.filter((c) => c.toLowerCase().includes(q)) : ALL_COUNTRIES;
  }, [countryQuery]);

  // Live result count for the draft (a one-item page carries the total).
  const count = useLiveCount(
    draft,
    async (d) =>
      (await getArticles({ serviceId: articleServiceIds(d, categories), country: d.countries, page: 1, pageSize: 1 }))
        .total
  );

  function setCategories(next: string[]) {
    // Keep only services that still belong to the chosen categories.
    const allowed = new Set(
      categories.filter((c) => next.length === 0 || next.includes(c.id)).flatMap((c) => c.services.map((s) => s.id))
    );
    setDraft((d) => ({ ...d, categories: next, services: d.services.filter((id) => allowed.has(id)) }));
  }

  const selectedTotal = draft.countries.length + draft.categories.length + draft.services.length;

  return (
    <FilterSheet
      onClose={onClose}
      onApply={() => onApply(draft)}
      onClear={() => setDraft({ countries: [], categories: [], services: [] })}
      canClear={selectedTotal > 0}
      count={count}
      noun={{ one: 'article', other: 'articles' }}
    >
      <FilterSheetSection title="Country" selected={draft.countries.length} defaultOpen>
        <FilterSheetSearch value={countryQuery} onChange={setCountryQuery} label="countries" />
        <FilterSheetOptions
          options={countries.map((c) => ({ value: c, label: c }))}
          selected={draft.countries}
          onToggle={(v) => setDraft((d) => ({ ...d, countries: toggle(d.countries, v) }))}
          scroll
          emptyText="No matching countries."
        />
      </FilterSheetSection>
      <FilterSheetSection title="Category" selected={draft.categories.length}>
        <FilterSheetOptions
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          selected={draft.categories}
          onToggle={(v) => setCategories(toggle(draft.categories, v))}
        />
      </FilterSheetSection>
      <FilterSheetSection title="Service" selected={draft.services.length}>
        <FilterSheetOptions
          options={services.map((s) => ({ value: s.id, label: s.name }))}
          selected={draft.services}
          onToggle={(v) => setDraft((d) => ({ ...d, services: toggle(d.services, v) }))}
          scroll
          emptyText="No services in the chosen categories."
        />
      </FilterSheetSection>
    </FilterSheet>
  );
}
