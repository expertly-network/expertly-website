import type { MemberDto } from '@shared/member';

const TOTAL_CHECKS = 10;

// Ports the prototype's own 10-point profile-completeness checklist onto
// MemberDto's real field names (confirmed by direct read of
// design/static_html/assets member-profile.html's completion logic — see
// the design spec §4.3). Evenly weighted, no per-item scoring.
export function computeCompletionPct(member: MemberDto): number {
  const checks = [
    Boolean(member.photoUrl),
    Boolean(member.headline),
    Boolean(member.bio),
    member.engagements.length > 0,
    member.educations.length > 0,
    member.workExperiences.length > 0,
    Boolean(member.contactEmail),
    Boolean(member.contactPhone),
    Boolean(member.linkedinUrl),
    Boolean(member.rateMinCents && member.rateMaxCents),
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / TOTAL_CHECKS) * 100);
}
