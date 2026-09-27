import type { MemberEditSection, MemberProfileEditDto } from '@shared/member';

// Per the prototype's own explicit design decision (confirmed by direct
// read): education/work_experiences show no section-level badge at all —
// "too many small, evolving facts to badge individually there". Edits still
// submit normally for these sections; only the badge UI is suppressed.
const NO_BADGE_SECTIONS: readonly MemberEditSection[] = ['education', 'work_experiences'];

// Matches design/static_html/member-profile.html's sectionBadgeHtml() exactly: pending (amber)
// if the latest edit for this section is awaiting review; verified (green) if the latest edit
// was approved or the member is already Expertly-verified overall (with no pending edit in the
// way); otherwise no badge. `isVerified` is the member's own MemberDto.isVerified.
export function getSectionEditBadge(
  section: MemberEditSection,
  edits: MemberProfileEditDto[],
  isVerified: boolean
): 'pending' | 'verified' | null {
  if (NO_BADGE_SECTIONS.includes(section)) return null;

  const latest = edits
    .filter((edit) => edit.section === section)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];

  if (latest?.status === 'pending') return 'pending';
  if (latest?.status === 'verified' || isVerified) return 'verified';
  return null;
}
