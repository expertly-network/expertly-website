import { apiFetch } from '@/lib/api/client';
import type {
  MyInterviewDto,
  MyInterviewResponse,
  StartInterviewRequest,
  StartInterviewResponse,
  UpdateInterviewSummaryRequest,
} from '@shared/interview';

export function getMyInterview(): Promise<MyInterviewResponse> {
  return apiFetch<MyInterviewResponse>('/interviews/me');
}

// Runs the planner on the first start (~5–15 s); the caller shows a "preparing" state.
export function startInterview(body: StartInterviewRequest): Promise<StartInterviewResponse> {
  return apiFetch<StartInterviewResponse>('/interviews/me/start', { method: 'POST', body: JSON.stringify(body) });
}

export function endInterview(): Promise<void> {
  return apiFetch<void>('/interviews/me/end', { method: 'POST' });
}

export function updateInterviewSummary(body: UpdateInterviewSummaryRequest): Promise<MyInterviewDto> {
  return apiFetch<MyInterviewDto>('/interviews/me/summary', { method: 'PATCH', body: JSON.stringify(body) });
}
