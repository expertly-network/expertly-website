import { apiFetch } from '@/lib/api/client';
import type { ApplicationDto, CreateApplicationRequest } from '@shared/membership-application';

export function submitApplication(body: CreateApplicationRequest): Promise<ApplicationDto> {
  return apiFetch<ApplicationDto>('/applications', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getMyApplication(): Promise<ApplicationDto> {
  return apiFetch<ApplicationDto>('/applications/me');
}
