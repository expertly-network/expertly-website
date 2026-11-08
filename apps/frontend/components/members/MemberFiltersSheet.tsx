'use client';

import { useMemo, useState } from 'react';
import { useLiveCount } from '@/lib/hooks/useLiveCount';
import { FilterSheet, FilterSheetOptions, FilterSheetSearch, FilterSheetSection } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { RATE_BUCKETS, rateBucketFor } from '@/lib/members/rate-buckets';
import { DEFAULT_SORT, MEMBER_SORT_OPTIONS, type MemberFilters, type MemberSort } from '@/lib/members/search-params';
import { getMembersPage } from '@/lib/api/members';
import type { CategoryDto } from '@shared/category';

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Phone filter sheet for the member directory (built on ui/FilterSheet): sort, category, service,
// country and price in collapsible sections with a live "Show N members" count. Applying hands the
// draft back to DirectoryFilterBar, which writes it to the URL like the desktop dropdowns do. The
// hero's keyword search (`q`) is carried through untouched.
export function MemberFiltersSheet({
  categories,
  value,
  onApply,
  onClose,
}: {
  categories: CategoryDto[];
  value: MemberFilters;
  onApply: (next: MemberFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MemberFilters>(value);
  const [countryQuery, setCountryQuery] = useState('');

  const services = useMemo(
    () =>
      draft.categoryId
        ? (categories.find((c) => c.id === draft.categoryId)?.services ?? [])
        : categories.flatMap((c) => c.services),
    [categories, draft.categoryId]
  );
  const countries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    return (q ? ALL_COUNTRIES.filter((c) => c.toLowerCase().includes(q)) : ALL_COUNTRIES).map((c) => ({
      value: c,
      label: c,
    }));
  }, [countryQuery]);

  // Live result count for the draft (a one-item page carries the total).
  const count = useLiveCount(draft, async (d) => (await getMembersPage({ ...d, page: 1, pageSize: 1 })).total);

  const bucket = rateBucketFor(draft);
  const canClear =
    draft.sort !== DEFAULT_SORT ||
    !!draft.categoryId ||
    draft.serviceId.length > 0 ||
    draft.country.length > 0 ||
    draft.rateMinCents !== undefined ||
    draft.rateMaxCents !== undefined;

  return (
    <FilterSheet
      onClose={onClose}
      onApply={() => onApply(draft)}
      onClear={() => setDraft({ q: draft.q, serviceId: [], country: [], sort: DEFAULT_SORT })}
      canClear={canClear}
      count={count}
      noun={{ one: 'member', other: 'members' }}
    >
      <FilterSheetSection title="Sort by" selected={draft.sort === DEFAULT_SORT ? 0 : 1}>
        <FilterSheetOptions
          single
          name="member-sort"
          options={MEMBER_SORT_OPTIONS}
          selected={[draft.sort]}
          onToggle={(v) => setDraft((d) => ({ ...d, sort: v as MemberSort }))}
        />
      </FilterSheetSection>
      <FilterSheetSection title="Category" selected={draft.categoryId ? 1 : 0} defaultOpen>
        <FilterSheetOptions
          single
          name="member-category"
          options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          selected={[draft.categoryId ?? '']}
          // Services belong to a category, so changing it clears them.
          onToggle={(v) => setDraft((d) => ({ ...d, categoryId: v || undefined, serviceId: [] }))}
          scroll
        />
      </FilterSheetSection>
      <FilterSheetSection title="Service" selected={draft.serviceId.length}>
        <FilterSheetOptions
          options={services.map((s) => ({ value: s.id, label: s.name }))}
          selected={draft.serviceId}
          onToggle={(v) => setDraft((d) => ({ ...d, serviceId: toggle(d.serviceId, v) }))}
          scroll
          emptyText="No services in this category."
        />
      </FilterSheetSection>
      <FilterSheetSection title="Country" selected={draft.country.length}>
        <FilterSheetSearch value={countryQuery} onChange={setCountryQuery} label="countries" />
        <FilterSheetOptions
          options={countries}
          selected={draft.country}
          onToggle={(v) => setDraft((d) => ({ ...d, country: toggle(d.country, v) }))}
          scroll
          emptyText="No matching countries."
        />
      </FilterSheetSection>
      <FilterSheetSection title="Price" selected={bucket ? 1 : 0}>
        <FilterSheetOptions
          single
          name="member-price"
          options={[
            { value: '', label: 'Any price' },
            ...RATE_BUCKETS.map((b) => ({ value: b.label, label: b.label })),
          ]}
          selected={[bucket?.label ?? '']}
          onToggle={(v) => {
            const next = RATE_BUCKETS.find((b) => b.label === v);
            setDraft((d) => ({ ...d, rateMinCents: next?.rateMinCents, rateMaxCents: next?.rateMaxCents }));
          }}
        />
      </FilterSheetSection>
    </FilterSheet>
  );
}
