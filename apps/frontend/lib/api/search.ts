import { apiFetch } from '@/lib/api/client';
import type {
  SearchFeedbackRequest,
  SearchFeedbackResponse,
  SearchQuestionRequest,
  SearchResponse,
} from '@shared/search';

// POST /v1/search — signed-in only, takes several seconds (two AI calls). A 429 surfaces as an
// ApiError with `retryAfterSeconds`; a guest gets a 401 ApiError.
export function searchDirectory(body: SearchQuestionRequest, signal?: AbortSignal): Promise<SearchResponse> {
  return apiFetch<SearchResponse>('/search', { method: 'POST', body: JSON.stringify(body), signal });
}

// Thumbs up (1) / down (-1) on an earlier answer; `logId` comes from that answer's response.
export function sendSearchFeedback(body: Omit<SearchFeedbackRequest, 'action'>): Promise<SearchFeedbackResponse> {
  const request: SearchFeedbackRequest = { action: 'feedback', ...body };
  return apiFetch<SearchFeedbackResponse>('/search', { method: 'POST', body: JSON.stringify(request) });
}
