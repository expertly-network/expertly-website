import type { ListArticlesQuery } from '@shared/article';

// Response header carrying the total match count of a paged GET /v1/articles (body stays an array).
export const ARTICLES_TOTAL_COUNT_HEADER = 'X-Total-Count';

// Shared by the server (lib/api/server.ts) and browser (lib/api/articles.ts) fetchers.
export function buildArticlesQueryString(query: ListArticlesQuery = {}): string {
  const search = new URLSearchParams();
  if (query.authorId) search.set('authorId', query.authorId);
  for (const id of query.serviceId ?? []) search.append('serviceId', id);
  for (const c of query.country ?? []) search.append('country', c);
  if (query.excludeId) search.set('excludeId', query.excludeId);
  if (query.page !== undefined) search.set('page', String(query.page));
  if (query.pageSize !== undefined) search.set('pageSize', String(query.pageSize));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// Browse grid page size — 12 fills whole rows at every breakpoint (1, 2 and 3 columns).
export const ARTICLES_PAGE_SIZE = 12;
