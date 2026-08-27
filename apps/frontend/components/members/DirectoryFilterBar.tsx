'use client';

import { useRouter, usePathname } from 'next/navigation';
import { FilterPopover } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { RATE_BUCKETS } from '@/lib/members/rate-buckets';
import { filtersToSearchParams, type MemberFilters, type MemberSort } from '@/lib/members/search-params';
import type { PracticeAreaDto } from '@shared/practice-area';

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
  practiceAreas,
  filters,
}: {
  practiceAreas: PracticeAreaDto[];
  filters: MemberFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(next: MemberFilters) {
    const params = filtersToSearchParams(next);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      <FilterPopover
        label="All practices"
        options={practiceAreas.map((p) => ({ value: p.id, label: p.name }))}
        selected={filters.practiceAreaId}
        onChange={(practiceAreaId) => apply({ ...filters, practiceAreaId })}
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
