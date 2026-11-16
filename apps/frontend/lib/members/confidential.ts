// What everyone but the owner and admins sees in place of a confidential engagement's client (the
// API substitutes it server-side; the real name is never sent). Same text as the backend's
// CONFIDENTIAL_CLIENT_LABEL (apps/backend/src/members/member-sections.ts).
export const CONFIDENTIAL_CLIENT_LABEL = 'Confidential client';

/** True when the viewer is being shown a confidential engagement's real client name (owner / admin). */
export function seesConfidentialName(engagement: { isConfidential?: boolean; clientName?: string | null }): boolean {
  return (
    engagement.isConfidential === true && !!engagement.clientName && engagement.clientName !== CONFIDENTIAL_CLIENT_LABEL
  );
}
