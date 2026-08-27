import type { MemberEditSection, MemberProfileEditDto } from '@shared/member';

// Per the prototype's own explicit design decision (confirmed by direct
// read): education/work_experiences show no section-level pending badge —
// "too many small, evolving facts to badge individually there". Edits still
// submit normally for these sections; only the badge UI is suppressed.
const NO_BADGE_SECTIONS: readonly MemberEditSection[] = ['education', 'work_experiences'];

export function getSectionEditBadge(
  section: MemberEditSection,
  edits: MemberProfileEditDto[]
): 'pending' | null {
  if (NO_BADGE_SECTIONS.includes(section)) return null;

  const latest = edits
    .filter((edit) => edit.section === section)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];

  return latest?.status === 'pending' ? 'pending' : null;
}
