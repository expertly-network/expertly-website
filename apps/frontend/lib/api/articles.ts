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

// Returns published articles, optionally filtered by author.
export function getArticles(params: { authorId?: string } = {}): Promise<ArticleListItemDto[]> {
  const search = new URLSearchParams();
  if (params.authorId) search.set('authorId', params.authorId);
  const qs = search.toString();
  return apiFetch<ArticleListItemDto[]>(`/articles${qs ? `?${qs}` : ''}`);
}

// Generates an AI draft; multipart so source files can ride along as sibling file parts.
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

/** Only the fields passed change. */
export function updateArticle(id: string, payload: UpdateArticleRequest): Promise<ArticleDto> {
  return apiFetch<ArticleDto>(`/articles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Suggests article title ideas. */
export function suggestTopics(payload: SuggestTopicsRequest = {}): Promise<SuggestTopicsResponse> {
  return apiFetch<SuggestTopicsResponse>('/articles/suggest-topics', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Unsplash cover image suggestions, proxied through the backend. */
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
