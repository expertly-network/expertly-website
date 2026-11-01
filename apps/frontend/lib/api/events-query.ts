import type { ListEventsQuery } from '@shared/event';

// Response header carrying the total match count of a paged GET /v1/events (body stays an array).
export const EVENTS_TOTAL_COUNT_HEADER = 'X-Total-Count';

// /events browse page size; reaching the end fetches the next page.
export const EVENTS_PAGE_SIZE = 30;

// Shared by the server (lib/api/server.ts) and browser (lib/api/events.ts) fetchers.
export function buildEventsQueryString(query: ListEventsQuery = {}): string {
  const search = new URLSearchParams();
  if (query.upcoming) search.set('upcoming', query.upcoming);
  if (query.from) search.set('from', query.from);
  if (query.startFrom) search.set('startFrom', query.startFrom);
  if (query.to) search.set('to', query.to);
  if (query.q) search.set('q', query.q);
  for (const c of query.country ?? []) search.append('country', c);
  for (const f of query.format ?? []) search.append('format', f);
  for (const t of query.type ?? []) search.append('type', t);
  for (const id of query.categoryId ?? []) search.append('categoryId', id);
  for (const id of query.serviceLineId ?? []) search.append('serviceLineId', id);
  if (query.page !== undefined) search.set('page', String(query.page));
  if (query.pageSize !== undefined) search.set('pageSize', String(query.pageSize));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// A local calendar day as the API's ISO date (YYYY-MM-DD) — no time-zone shift.
export function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
