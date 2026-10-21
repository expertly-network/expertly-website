import { apiFetch, ApiError } from '@/lib/api/client';
import type {
  AdminApplicationReviewRequest,
  ApplicationDto,
  CouponPreviewRequest,
  CouponPreviewResponse,
  LinkedInImportRequest,
  LinkedInImportResponse,
  LinkedInPhotoImportRequest,
  UpdateApplicationRequest,
} from '@shared/membership-application';

/** Saves or submits the caller's application — an upsert. */
export function saveApplication(patch: UpdateApplicationRequest): Promise<ApplicationDto> {
  return apiFetch<ApplicationDto>('/applications/me', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

/** Returns null when the caller has no application yet. */
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

/** Stateless price calculation for the review step's live coupon preview. */
export function previewCoupon(body: CouponPreviewRequest): Promise<CouponPreviewResponse> {
  return apiFetch<CouponPreviewResponse>('/applications/me/coupon-preview', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Best-effort: imports a LinkedIn profile photo — `sourceUrl` (the high-res photo from the
 * LinkedIn import) when given, otherwise the linked LinkedIn identity's low-res picture.
 */
export function importLinkedInPhoto(sourceUrl?: string): Promise<ApplicationDto> {
  const body: LinkedInPhotoImportRequest = sourceUrl ? { sourceUrl } : {};
  return apiFetch<ApplicationDto>('/applications/me/photo/linkedin', {
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

/** Admin review action. 🛡️ manageApplications. */
export function reviewApplication(
  id: string,
  payload: AdminApplicationReviewRequest
): Promise<{ status: 'approved' | 'rejected' }> {
  return apiFetch<{ status: 'approved' | 'rejected' }>(`/admin/applications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
