import { apiFetch } from '@/lib/api/client';
import type { CreateRecommendationRequestRequest, RecommendationRequestDto } from '@shared/recommendation-request';

/** Ask another active member (`memberId`) for a recommendation. They are emailed. */
export function createRecommendationRequest(
  memberId: string,
  body: CreateRecommendationRequestRequest
): Promise<RecommendationRequestDto> {
  return apiFetch<RecommendationRequestDto>(`/members/${memberId}/recommendation-requests`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** `received`: pending asks for me. `sent`: what I asked (an ignored request shows as pending). */
export function getMyRecommendationRequests(direction: 'sent' | 'received'): Promise<RecommendationRequestDto[]> {
  return apiFetch<RecommendationRequestDto[]>(`/members/me/recommendation-requests?direction=${direction}`);
}

/** The recipient ignores (silent) or the requester cancels. */
export function updateRecommendationRequest(
  requestId: string,
  action: 'ignore' | 'cancel'
): Promise<RecommendationRequestDto> {
  return apiFetch<RecommendationRequestDto>(`/recommendation-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
}
