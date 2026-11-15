import { apiFetch } from '@/lib/api/client';
import type { MemberEditSection } from '@shared/member';
import type { AdminSetContactVerifiedRequest, AdminSetItemVerifiedRequest } from '@shared/member-verification';

// 🛡️ manageMembers — verify (or un-verify) one item of a member's profile.
export function setItemVerified(
  memberId: string,
  section: MemberEditSection,
  itemId: string,
  body: AdminSetItemVerifiedRequest
): Promise<void> {
  return apiFetch<void>(`/admin/members/${memberId}/sections/${section}/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function setContactVerified(memberId: string, body: AdminSetContactVerifiedRequest): Promise<void> {
  return apiFetch<void>(`/admin/members/${memberId}/contact-verification`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// 🛡️ manageMembers — give or remove the whole-profile "GrowXQ Verified" badge.
export function setProfileVerified(memberId: string, body: AdminSetItemVerifiedRequest): Promise<void> {
  return apiFetch<void>(`/admin/members/${memberId}/profile-verification`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
