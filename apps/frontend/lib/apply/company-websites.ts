import type { WorkExperienceInput } from '@shared/membership-application';

export function companyKey(company: string): string {
  return company.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** One website per company, copied onto each role for the existing API/profile contract. */
export function shareCompanyWebsites(roles: WorkExperienceInput[]): WorkExperienceInput[] {
  const websites = new Map<string, string>();
  for (const role of roles) {
    const key = companyKey(role.company);
    if (key && role.companyUrl?.trim() && !websites.has(key)) websites.set(key, role.companyUrl);
  }
  return roles.map((role) => {
    const website = websites.get(companyKey(role.company));
    return website && website !== role.companyUrl ? { ...role, companyUrl: website } : role;
  });
}
