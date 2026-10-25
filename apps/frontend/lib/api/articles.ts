import { apiFetch, apiFetchPage } from '@/lib/api/client';
import { ARTICLES_TOTAL_COUNT_HEADER, buildArticlesQueryString } from '@/lib/api/articles-query';
import type {
  AdminArticleReviewRequest,
  AiDraftArticleRequest,
  AiDraftArticleResponse,
  AiFollowUpQuestionsRequest,
  AiFollowUpQuestionsResponse,
  ArticleDto,
  ArticleListItemDto,
  CoverImageSuggestionsResponse,
  CreateArticleRequest,
  ListArticlesQuery,
  RefineArticleDraftRequest,
  SuggestTopicsRequest,
  SuggestTopicsResponse,
  UpdateArticleRequest,
} from '@shared/article';

// Published articles matching `query`, plus the total match count across all pages.
export function getArticles(
  query: ListArticlesQuery = {}
): Promise<{ items: ArticleListItemDto[]; total: number }> {
  return apiFetchPage<ArticleListItemDto>(
    `/articles${buildArticlesQueryString(query)}`,
    ARTICLES_TOTAL_COUNT_HEADER
  );
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

/** Analyzes the wizard's step-1 brief and returns 0-10 follow-up questions. */
export function getFollowUpQuestions(
  payload: AiFollowUpQuestionsRequest
): Promise<AiFollowUpQuestionsResponse> {
  return apiFetch<AiFollowUpQuestionsResponse>('/articles/ai-followup-questions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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

/** Owner or admin. Permanently deletes the article (204). */
export function deleteArticle(id: string): Promise<void> {
  return apiFetch<void>(`/articles/${id}`, { method: 'DELETE' });
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
