import { apiFetch } from '@/lib/api/client';
import type { SearchFeedbackResponse, SearchResponse, SearchScope } from '@shared/search';

// POST /v1/search — signed-in only, takes several seconds (two AI calls). A 429 surfaces as an
// ApiError with `retryAfterSeconds`; a guest gets a 401 ApiError.
export function searchDirectory(
  body: { query: string; scope?: SearchScope; limit?: number },
  signal?: AbortSignal
): Promise<SearchResponse> {
  return apiFetch<SearchResponse>('/search', { method: 'POST', body: JSON.stringify(body), signal });
}

// Thumbs up (1) / down (-1) on an earlier answer; `logId` comes from that answer's response.
export function sendSearchFeedback(body: {
  logId: string;
  rating: 1 | -1;
  note?: string;
}): Promise<SearchFeedbackResponse> {
  return apiFetch<SearchFeedbackResponse>('/search', {
    method: 'POST',
    body: JSON.stringify({ action: 'feedback', ...body }),
  });
}
