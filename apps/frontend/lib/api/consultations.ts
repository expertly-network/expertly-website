import { apiFetch } from '@/lib/api/client';
import type {
  ConsultationMessageDto,
  ConsultationRequestDto,
  CreateConsultationRequestRequest,
} from '@shared/consultation-request';

export interface ConsultationEligibility {
  blocked: boolean;
  reason: 'pending' | 'rate_limited' | null;
  retryAfter: string | null;
}

// Called before the request form even opens — see consultations.service.ts#checkEligibility.
// Covers both gates a new request can hit: an existing pending request to this member, or the
// requester's daily rate limit.
export function checkConsultationEligibility(memberId: string): Promise<ConsultationEligibility> {
  return apiFetch<ConsultationEligibility>(`/consultations/can-request/${memberId}`);
}

export function createConsultation(body: CreateConsultationRequestRequest): Promise<ConsultationRequestDto> {
  return apiFetch<ConsultationRequestDto>('/consultations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateConsultationStatus(
  id: string,
  status: 'completed' | 'declined',
  responseMessage: string
): Promise<ConsultationRequestDto> {
  return apiFetch<ConsultationRequestDto>(`/consultations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, responseMessage }),
  });
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
  return apiFetch<ConsultationRequestDto>(`/consultations/${id}/rating`, {
    method: 'PATCH',
    body: JSON.stringify({ rating }),
  });
}
