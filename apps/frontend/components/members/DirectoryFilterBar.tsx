'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { FilterPopover, MobileFilterBar, type FilterChip } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { RATE_BUCKETS, rateBucketFor } from '@/lib/members/rate-buckets';
import {
  DEFAULT_SORT,
  MEMBER_SORT_OPTIONS,
  filtersToSearchParams,
  type MemberFilters,
  type MemberSort,
} from '@/lib/members/search-params';
import { MemberFiltersSheet } from '@/components/members/MemberFiltersSheet';
import type { CategoryDto } from '@shared/category';

function rateBucketValue(filters: MemberFilters): string[] {
  const match = rateBucketFor(filters);
  return match ? [match.label] : [];
}

// Larger screens: one dropdown per filter. Phones: a sticky "Filters" bar (with the match count)
// opening MemberFiltersSheet, then removable chips for what's active. Both write the URL.
export function DirectoryFilterBar({
  categories,
  filters,
  total,
}: {
  categories: CategoryDto[];
  filters: MemberFilters;
  /** Matches for the current filters, for the phone bar. */
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  function apply(next: MemberFilters) {
    const params = filtersToSearchParams(next);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  // Narrows the service list to the selected category; falls back to every service when no
  // category is picked, matching the two-level pill+dropdown UI from the taxonomy design.
  const visibleServices = filters.categoryId
    ? (categories.find((c) => c.id === filters.categoryId)?.services ?? [])
    : categories.flatMap((c) => c.services);

  const bucket = rateBucketFor(filters);
  const categoryName = filters.categoryId ? categories.find((c) => c.id === filters.categoryId)?.name : undefined;
  const serviceName = (id: string) => categories.flatMap((c) => c.services).find((sv) => sv.id === id)?.name ?? id;
  const chips: FilterChip[] = [
    ...(filters.sort !== DEFAULT_SORT
      ? [
          {
            key: 'sort',
            label: `Sort: ${MEMBER_SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? filters.sort}`,
            onRemove: () => apply({ ...filters, sort: DEFAULT_SORT }),
          },
        ]
      : []),
    ...(categoryName
      ? [
          {
            key: 'category',
            label: categoryName,
            onRemove: () => apply({ ...filters, categoryId: undefined, serviceId: [] }),
          },
        ]
      : []),
    ...filters.serviceId.map((id) => ({
      key: `service-${id}`,
      label: serviceName(id),
      onRemove: () => apply({ ...filters, serviceId: filters.serviceId.filter((v) => v !== id) }),
    })),
    ...filters.country.map((c) => ({
      key: `country-${c}`,
      label: c,
      onRemove: () => apply({ ...filters, country: filters.country.filter((v) => v !== c) }),
    })),
    ...(bucket
      ? [
          {
            key: 'price',
            label: bucket.label,
            onRemove: () => apply({ ...filters, rateMinCents: undefined, rateMaxCents: undefined }),
          },
        ]
      : []),
  ];
  const activeCount = chips.length;

  return (
    <>
      {/* Phones: Filters button + match count (sticky) and removable chips; larger screens use the
          dropdowns below. */}
      <MobileFilterBar
        activeCount={activeCount}
        countLabel={`${total} member${total === 1 ? '' : 's'}`}
        onOpen={() => setSheetOpen(true)}
        chips={chips}
      />
      {sheetOpen && (
        <MemberFiltersSheet
          categories={categories}
          value={filters}
          onApply={(next) => {
            setSheetOpen(false);
            apply(next);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}

      <div className="hidden flex-wrap gap-2.5 sm:flex">
        <FilterPopover
          label="All categories"
          multi={false}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          selected={filters.categoryId ? [filters.categoryId] : []}
          onChange={(values) => apply({ ...filters, categoryId: values[0], serviceId: [] })}
        />
        <FilterPopover
          label="All services"
          options={visibleServices.map((s) => ({ value: s.id, label: s.name }))}
          selected={filters.serviceId}
          onChange={(serviceId) => apply({ ...filters, serviceId })}
        />
        <FilterPopover
          label="All countries"
          options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
          selected={filters.country}
          onChange={(country) => apply({ ...filters, country })}
        />
        <FilterPopover
          label="All prices"
          multi={false}
          searchable={false}
          options={RATE_BUCKETS.map((b) => ({ value: b.label, label: b.label }))}
          selected={rateBucketValue(filters)}
          onChange={(values) => {
            const bucket = RATE_BUCKETS.find((b) => b.label === values[0]);
            apply({
              ...filters,
              rateMinCents: bucket?.rateMinCents,
              rateMaxCents: bucket?.rateMaxCents,
            });
          }}
        />
        <FilterPopover
          label="Featured"
          prefix="Sort:"
          clearable={false}
          multi={false}
          searchable={false}
          options={MEMBER_SORT_OPTIONS}
          selected={[filters.sort]}
          onChange={(values) => apply({ ...filters, sort: (values[0] as MemberSort) ?? 'featured' })}
        />
      </div>
    </>
  );
}
