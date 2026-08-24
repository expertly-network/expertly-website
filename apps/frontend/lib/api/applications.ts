import { apiFetch, ApiError } from '@/lib/api/client';
import type {
  ApplicationDto,
  LinkedInImportRequest,
  LinkedInImportResponse,
  UpdateApplicationRequest,
} from '@shared/membership-application';

/** Saves or submits the caller's application — an upsert, see docs/rest-api.md. */
export function saveApplication(patch: UpdateApplicationRequest): Promise<ApplicationDto> {
  return apiFetch<ApplicationDto>('/applications/me', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

/** Returns null (not a thrown error) when the caller has no application yet — the common case
 * for a first-time visitor to /apply, not an exceptional one. */
export async function getMyApplication(): Promise<ApplicationDto | null> {
  try {
    return await apiFetch<ApplicationDto>('/applications/me');
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export function importLinkedIn(body: LinkedInImportRequest): Promise<LinkedInImportResponse> {
  return apiFetch<LinkedInImportResponse>('/applications/me/linkedin-import', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function uploadApplicationFile(kind: 'photo' | 'document', file: File): Promise<ApplicationDto> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);
  return apiFetch<ApplicationDto>('/applications/me/uploads', {
    method: 'POST',
    body: form,
  });
}
