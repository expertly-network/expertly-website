import { apiFetch } from '@/lib/api/client';
import type { ArticleListItemDto } from '@shared/article';

// First client-side articles fetcher in the app — only `authorId` is needed
// for the profile page's Articles tab (Task 15). Category/country filtering
// exists on the backend too but has no caller yet; add params here if/when
// a future articles-browse session needs them, not speculatively now.
export function getArticles(params: { authorId?: string } = {}): Promise<ArticleListItemDto[]> {
  const search = new URLSearchParams();
  if (params.authorId) search.set('authorId', params.authorId);
  const qs = search.toString();
  return apiFetch<ArticleListItemDto[]>(`/articles${qs ? `?${qs}` : ''}`);
}
