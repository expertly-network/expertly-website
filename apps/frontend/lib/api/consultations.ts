import { apiFetch } from '@/lib/api/client';
import type {
  ConsultationEligibilityResponse,
  ConsultationMessageDto,
  ConsultationRequestDto,
  CreateConsultationRequestRequest,
  UpdateConsultationRequest,
} from '@shared/consultation-request';

// Called before the request form even opens — see consultations.service.ts#checkEligibility.
// Covers both gates a new request can hit: an existing pending request to this member, or the
// requester's daily rate limit.
export function checkConsultationEligibility(memberId: string): Promise<ConsultationEligibilityResponse> {
  return apiFetch<ConsultationEligibilityResponse>(`/consultations/can-request/${encodeURIComponent(memberId)}`);
}

export function createConsultation(body: CreateConsultationRequestRequest): Promise<ConsultationRequestDto> {
  return apiFetch<ConsultationRequestDto>('/consultations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Both participants update through PATCH /consultations/:id — the member decides, the requester rates.
function updateConsultation(id: string, body: UpdateConsultationRequest): Promise<ConsultationRequestDto> {
  return apiFetch<ConsultationRequestDto>(`/consultations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function updateConsultationStatus(
  id: string,
  status: 'completed' | 'declined',
  responseMessage: string
): Promise<ConsultationRequestDto> {
  return updateConsultation(id, { status, responseMessage });
}

export function listConsultationMessages(id: string): Promise<ConsultationMessageDto[]> {
  return apiFetch<ConsultationMessageDto[]>(`/consultations/${id}/messages`);
}

export function postConsultationMessage(id: string, body: string): Promise<ConsultationMessageDto> {
  return apiFetch<ConsultationMessageDto>(`/consultations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export function rateConsultation(id: string, rating: number): Promise<ConsultationRequestDto> {
  return updateConsultation(id, { rating });
}
