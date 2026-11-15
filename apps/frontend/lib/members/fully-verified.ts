import type { MemberDto } from '@shared/member';

// "GrowXQ Verified" (the tick on the photo, the sidebar card, the PDF chip) is only claimed for a
// profile that is verified all the way: the admin's whole-profile approval, the contact block and
// every entry in every section. One pending entry and the profile is simply not fully verified yet.
export function isFullyVerified(member: MemberDto): boolean {
  const entries = [
    ...member.engagements,
    ...member.educations,
    ...member.workExperiences,
    ...member.keyClients,
    ...member.testimonials,
    ...member.awards,
  ];
  return member.isVerified && member.contactVerified && entries.every((entry) => entry.isVerified);
}
