import type { MemberEditSection, MemberProfileEditDto } from '@shared/member';

// Matches design/static_html/member-profile.html's sectionBadgeHtml() exactly: pending (amber)
// if the latest edit for this section is awaiting review; verified (green) if the latest edit
// was approved or the member is already Expertly-verified overall (with no pending edit in the
// way); otherwise no badge. `isVerified` is the member's own MemberDto.isVerified.
export function getSectionEditBadge(
  section: MemberEditSection,
  edits: MemberProfileEditDto[],
  isVerified: boolean
): 'pending' | 'verified' | null {
  const latest = edits
    .filter((edit) => edit.section === section)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];

  if (latest?.status === 'pending') return 'pending';
  if (latest?.status === 'verified' || isVerified) return 'verified';
  return null;
}

// The admin's reason, when the member's most recent edit to this section was rejected by a
// reviewer — shown only on the member's own profile (edits are only fetched for the owner).
// Edits closed automatically because the member resubmitted (no reviewer) don't count.
export function getSectionRejectionNote(section: MemberEditSection, edits: MemberProfileEditDto[]): string | null {
  const latest = edits
    .filter((edit) => edit.section === section)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
  if (latest?.status !== 'rejected' || !latest.reviewedBy) return null;
  return latest.reviewNote ?? 'Your last change to this section was not approved.';
}
