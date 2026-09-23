'use client';

import { useRouter, usePathname } from 'next/navigation';
import { FilterPopover } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { RATE_BUCKETS } from '@/lib/members/rate-buckets';
import { filtersToSearchParams, type MemberFilters, type MemberSort } from '@/lib/members/search-params';
import type { CategoryDto } from '@shared/category';

const SORT_OPTIONS: { value: MemberSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'tenure', label: 'Most experienced' },
  { value: 'rate_asc', label: 'Rate: low → high' },
  { value: 'rate_desc', label: 'Rate: high → low' },
];

function rateBucketValue(filters: MemberFilters): string[] {
  const match = RATE_BUCKETS.find(
    (b) => b.rateMinCents === filters.rateMinCents && b.rateMaxCents === filters.rateMaxCents
  );
  return match ? [match.label] : [];
}

export function DirectoryFilterBar({
  categories,
  filters,
}: {
  categories: CategoryDto[];
  filters: MemberFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(next: MemberFilters) {
    const params = filtersToSearchParams(next);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  // Narrows the service list to the selected category; falls back to every service when no
  // category is picked, matching the two-level pill+dropdown UI from the taxonomy design.
  const visibleServices = filters.categoryId
    ? categories.find((c) => c.id === filters.categoryId)?.services ?? []
    : categories.flatMap((c) => c.services);

  return (
    <div className="flex flex-wrap gap-2.5">
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
        multi={false}
        searchable={false}
        options={SORT_OPTIONS}
        selected={[filters.sort]}
        onChange={(values) => apply({ ...filters, sort: (values[0] as MemberSort) ?? 'featured' })}
      />
    </div>
  );
}
