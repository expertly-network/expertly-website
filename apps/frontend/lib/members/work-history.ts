import { formatWorkPeriod } from '@/lib/members/format';
import type { MemberWorkExperience } from '@shared/member';

// How work history is structured for display — shared by the profile page
// (components/members/WorkHistoryTimeline.tsx) and the profile PDF
// (components/members/pdf/MemberProfilePdf.tsx), so both always group and date roles identically.

export interface CompanyGroup {
  company: string;
  roles: MemberWorkExperience[];
}

// Consecutive roles at the same company (LinkedIn's grouped sub-roles: a promotion ladder, or
// several concurrent roles) form one company group with the roles nested inside, instead of
// unrelated entries. Only consecutive ones — a later return to the same firm stays separate.
export function groupByCompany(works: MemberWorkExperience[]): CompanyGroup[] {
  const groups: CompanyGroup[] = [];
  for (const work of works) {
    const last = groups[groups.length - 1];
    if (last && last.company.trim().toLowerCase() === work.company.trim().toLowerCase()) last.roles.push(work);
    else groups.push({ company: work.company, roles: [work] });
  }
  return groups;
}

// The whole span at a company: earliest start to latest end (or Present).
export function groupPeriod(roles: MemberWorkExperience[]) {
  const startYear = Math.min(...roles.map((r) => r.startYear));
  const isCurrent = roles.some((r) => r.isCurrent);
  const endYear = isCurrent ? null : Math.max(...roles.map((r) => r.endYear ?? r.startYear));
  return formatWorkPeriod(startYear, endYear, isCurrent);
}

export function rolePeriod(role: MemberWorkExperience) {
  return formatWorkPeriod(role.startYear, role.endYear, role.isCurrent);
}
