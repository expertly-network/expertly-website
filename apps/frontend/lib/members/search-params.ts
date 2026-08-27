// Single source of truth for the directory's filter shape, shared between:
// - the Server Component's initial searchParams read (Task 10)
// - the client filter bar's URL sync (Task 8)
// - getMembers()'s query-string construction (this file, below)
// Keeping parse/serialize together means the URL's shape can only drift in
// one place, not three.

export type MemberSort = 'featured' | 'tenure' | 'rate_asc' | 'rate_desc';

export const DEFAULT_SORT: MemberSort = 'featured';

// Shared between the initial server-rendered page (Task 10) and the client
// infinite-scroll list (Task 8/MemberDirectoryList) — both must agree on the
// page size for `hasMore` (`results.length === MEMBER_LIST_PAGE_SIZE`) to
// stay correct; defining it once here prevents the two from drifting apart.
export const MEMBER_LIST_PAGE_SIZE = 8;

export interface MemberFilters {
  q?: string;
  practiceAreaId: string[];
  country: string[];
  rateMinCents?: number;
  rateMaxCents?: number;
  sort: MemberSort;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseMemberFilters(searchParams: RawSearchParams): MemberFilters {
  return {
    q: toSingleTrimmed(searchParams.q),
    practiceAreaId: toArray(searchParams.practiceAreaId),
    country: toArray(searchParams.country),
    rateMinCents: toNumber(searchParams.rateMinCents),
    rateMaxCents: toNumber(searchParams.rateMaxCents),
    sort: toSort(searchParams.sort),
  };
}

export function filtersToSearchParams(filters: MemberFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const id of filters.practiceAreaId) params.append('practiceAreaId', id);
  for (const country of filters.country) params.append('country', country);
  if (filters.rateMinCents !== undefined) params.set('rateMinCents', String(filters.rateMinCents));
  if (filters.rateMaxCents !== undefined) params.set('rateMaxCents', String(filters.rateMaxCents));
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  return params;
}

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function toSingleTrimmed(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function toNumber(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function toSort(value: string | string[] | undefined): MemberSort {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'featured' || raw === 'tenure' || raw === 'rate_asc' || raw === 'rate_desc') {
    return raw;
  }
  return DEFAULT_SORT;
}
