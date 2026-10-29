// Single source of truth for the directory's filter shape — parse and serialize live together here.
export type MemberSort = 'featured' | 'tenure' | 'rate_asc' | 'rate_desc';

export const DEFAULT_SORT: MemberSort = 'featured';

// Shared with the client-side infinite-scroll list so both agree on page size.
export const MEMBER_LIST_PAGE_SIZE = 8;

export interface MemberFilters {
  q?: string;
  /** Narrows to "any service in this category" — combined with serviceId, both must match. */
  categoryId?: string;
  serviceId: string[];
  country: string[];
  rateMinCents?: number;
  rateMaxCents?: number;
  sort: MemberSort;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

// URL values are user-editable, so anything the API would reject (GET /v1/members validates its
// query) is dropped here — a hand-edited link shows unfiltered results instead of an error page.
// Mirrors apps/backend/src/members/dto/list-members-query.dto.ts.
const MAX_FILTER_VALUES = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseMemberFilters(searchParams: RawSearchParams): MemberFilters {
  const categoryId = toSingleTrimmed(searchParams.categoryId);
  return {
    q: toSingleTrimmed(searchParams.q)?.slice(0, 100),
    categoryId: categoryId && UUID.test(categoryId) ? categoryId : undefined,
    serviceId: toArray(searchParams.serviceId).filter((id) => UUID.test(id)).slice(0, MAX_FILTER_VALUES),
    country: toArray(searchParams.country)
      .filter((c) => c.length <= 100)
      .slice(0, MAX_FILTER_VALUES),
    rateMinCents: toNumber(searchParams.rateMinCents),
    rateMaxCents: toNumber(searchParams.rateMaxCents),
    sort: toSort(searchParams.sort),
  };
}

export function filtersToSearchParams(filters: MemberFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  for (const id of filters.serviceId) params.append('serviceId', id);
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
  // The API takes whole, non-negative cents.
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

function toSort(value: string | string[] | undefined): MemberSort {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'featured' || raw === 'tenure' || raw === 'rate_asc' || raw === 'rate_desc') {
    return raw;
  }
  return DEFAULT_SORT;
}
