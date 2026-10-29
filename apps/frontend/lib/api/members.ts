import { ApiError, apiFetch } from '@/lib/api/client';
import { filtersToSearchParams, type MemberFilters } from '@/lib/members/search-params';
import type {
  CreateMemberEditRequest,
  MemberDto,
  MemberListItemDto,
  MemberProfileEditDto,
  ReviewMemberEditRequest,
  MemberUploadContentType,
  UpdateMemberRequest,
  UploadResponse,
} from '@shared/member';

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

export function getMember(slug: string): Promise<MemberDto> {
  return apiFetch<MemberDto>(`/members/${encodeURIComponent(slug)}`);
}

export function getMyMemberEdits(id: string): Promise<MemberProfileEditDto[]> {
  return apiFetch<MemberProfileEditDto[]>(`/members/${id}/edits`);
}

export function createMemberEdit(
  id: string,
  body: CreateMemberEditRequest
): Promise<MemberProfileEditDto> {
  return apiFetch<MemberProfileEditDto>(`/members/${id}/edits`, {
    method: 'POST',
    body: JSON.stringify(body),
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

// 🛡️ manageMembers — approve or reject one pending edit. A reason is required to reject.
export function reviewMemberEdit(id: string, body: ReviewMemberEditRequest): Promise<MemberProfileEditDto> {
  return apiFetch<MemberProfileEditDto>(`/admin/member-edits/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
