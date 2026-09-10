import type { MemberDto } from '@shared/member';

const TOTAL_CHECKS = 10;

// Evenly weighted 10-point profile-completeness checklist.
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
