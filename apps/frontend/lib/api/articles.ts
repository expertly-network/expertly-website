import { apiFetch } from '@/lib/api/client';
import type {
  AdminArticleReviewRequest,
  AiDraftArticleRequest,
  AiDraftArticleResponse,
  ArticleDto,
  ArticleListItemDto,
  CoverImageSuggestionsResponse,
  CreateArticleRequest,
  RefineArticleDraftRequest,
  SuggestTopicsRequest,
  SuggestTopicsResponse,
  UpdateArticleRequest,
} from '@shared/article';

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

// Write-article flow (apps/frontend/app/(shell)/articles/write) — POST /v1/articles/ai-draft
// generates a draft to review/edit client-side (nothing saved yet); createArticle() saves it
// (or a manually-written one) via POST /v1/articles.
//
// Multipart, not JSON: the request payload travels as a `payload` field (JSON-stringified) so
// `sourceFiles` (the wizard's dropzone) can ride along as sibling file parts — see
// apps/backend/src/articles/articles.controller.ts's aiDraft handler.
export function generateArticleDraft(
  payload: AiDraftArticleRequest,
  sourceFiles: File[] = []
): Promise<AiDraftArticleResponse> {
  const form = new FormData();
  form.set('payload', JSON.stringify(payload));
  for (const file of sourceFiles) form.append('files', file);
  return apiFetch<AiDraftArticleResponse>('/articles/ai-draft', { method: 'POST', body: form });
}

export function refineArticleDraft(payload: RefineArticleDraftRequest): Promise<AiDraftArticleResponse> {
  return apiFetch<AiDraftArticleResponse>('/articles/ai-refine', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createArticle(payload: CreateArticleRequest): Promise<ArticleDto> {
  return apiFetch<ArticleDto>('/articles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Owner-or-admin edit — the write flow's edit mode (`/articles/write?edit=<id>`). Only the
 * fields passed change; omitting `status` leaves the article's current status untouched. */
export function updateArticle(id: string, payload: UpdateArticleRequest): Promise<ArticleDto> {
  return apiFetch<ArticleDto>(`/articles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** The write flow's "Stuck? Try a topic" chip row — a real AI call, regenerated on demand. */
export function suggestTopics(payload: SuggestTopicsRequest = {}): Promise<SuggestTopicsResponse> {
  return apiFetch<SuggestTopicsResponse>('/articles/suggest-topics', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** The write flow's "auto-selected cover image" — a live Unsplash search, proxied through the
 * backend so the access key never reaches the client. `query` omitted falls back to a generic
 * finance/legal query server-side. */
export function getCoverImageSuggestions(query?: string): Promise<CoverImageSuggestionsResponse> {
  const search = query ? `?query=${encodeURIComponent(query)}` : '';
  return apiFetch<CoverImageSuggestionsResponse>(`/articles/cover-images${search}`);
}

/** Admin review action — approve publishes immediately; reject requires a reason. 🛡️ manageArticles. */
export function reviewArticle(id: string, payload: AdminArticleReviewRequest): Promise<ArticleDto> {
  return apiFetch<ArticleDto>(`/admin/articles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
