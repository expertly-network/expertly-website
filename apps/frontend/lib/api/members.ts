import { ApiError, apiFetch, apiFetchPage } from '@/lib/api/client';
import { filtersToSearchParams, type MemberFilters } from '@/lib/members/search-params';
import type {
  MemberDto,
  MemberEditSection,
  MemberListItemDto,
  MemberUploadContentType,
  UpdateMemberRequest,
  UploadResponse,
} from '@shared/member';
import type { SaveMemberSectionResponse } from '@shared/member-verification';

export interface GetMembersParams extends MemberFilters {
  page?: number;
  pageSize?: number;
}

export function buildMembersQueryString(params: GetMembersParams): string {
  const search = filtersToSearchParams(params);
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function getMembers(params: GetMembersParams): Promise<MemberListItemDto[]> {
  return apiFetch<MemberListItemDto[]>(`/members${buildMembersQueryString(params)}`);
}

/** A directory page plus the total match count (X-Total-Count) — e.g. the phone filter sheet's live count. */
export function getMembersPage(params: GetMembersParams): Promise<{ items: MemberListItemDto[]; total: number }> {
  return apiFetchPage<MemberListItemDto>(`/members${buildMembersQueryString(params)}`, 'X-Total-Count');
}

export function getMember(slug: string): Promise<MemberDto> {
  return apiFetch<MemberDto>(`/members/${encodeURIComponent(slug)}`);
}

// Counts one view of a member's profile (POST /v1/members/:slug/views — always 204).
export async function recordMemberProfileView(slug: string): Promise<void> {
  await apiFetch<void>(`/members/${encodeURIComponent(slug)}/views`, { method: 'POST' });
}

/**
 * Owner-only: replaces one profile section and applies it at once (an admin verifies afterwards).
 * `payload` is the whole new section — see `SaveMemberSectionRequest`.
 */
export function saveMemberSection(
  id: string,
  section: MemberEditSection,
  payload: unknown
): Promise<SaveMemberSectionResponse> {
  return apiFetch<SaveMemberSectionResponse>(`/members/${id}/sections/${section}`, {
    method: 'PUT',
    body: JSON.stringify({ payload }),
  });
}

/** Owner-only: availability and/or photo, applied immediately. Returns the updated member. */
export function updateMember(id: string, body: UpdateMemberRequest): Promise<MemberDto> {
  return apiFetch<MemberDto>(`/members/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

const MEMBER_UPLOAD_CONTENT_TYPES: readonly MemberUploadContentType[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

function isMemberUploadContentType(type: string): type is MemberUploadContentType {
  return (MEMBER_UPLOAD_CONTENT_TYPES as readonly string[]).includes(type);
}

// Signed upload URL for `file` in the member's private proofs folder. Rejects an unsupported type
// up front with the same code the API uses, rather than letting the upload fail at Storage.
export function requestMemberUpload(id: string, file: File): Promise<UploadResponse> {
  if (!isMemberUploadContentType(file.type)) {
    return Promise.reject(
      new ApiError('Files must be a PDF or a JPEG, PNG, WebP or GIF image.', 400, 'UPLOAD_INVALID_TYPE')
    );
  }
  return apiFetch<UploadResponse>(`/members/${id}/uploads`, {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name.slice(-200), contentType: file.type }),
  });
}
