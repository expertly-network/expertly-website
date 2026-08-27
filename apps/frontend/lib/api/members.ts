import { apiFetch } from '@/lib/api/client';
import { filtersToSearchParams, type MemberFilters } from '@/lib/members/search-params';
import type {
  CreateMemberEditRequest,
  MemberDto,
  MemberListItemDto,
  MemberProfileEditDto,
  UploadRequest,
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

export function getMember(id: string): Promise<MemberDto> {
  return apiFetch<MemberDto>(`/members/${id}`);
}

export function getMyMemberEdits(id: string): Promise<MemberProfileEditDto[]> {
  return apiFetch<MemberProfileEditDto[]>(`/members/${id}/edits`);
}

export function createMemberEdit(
  id: string,
  body: CreateMemberEditRequest
): Promise<MemberProfileEditDto> {
  return apiFetch<MemberProfileEditDto>(`/members/${id}/edits`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function requestMemberUpload(id: string, body: UploadRequest): Promise<UploadResponse> {
  return apiFetch<UploadResponse>(`/members/${id}/uploads`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
