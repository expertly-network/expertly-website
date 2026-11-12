import type { EducationInput, WorkExperienceInput } from '@shared/membership-application';
import { companyKey, shareCompanyWebsites } from '@/lib/apply/company-websites';
import { isEndBeforeStart } from '@/lib/apply/work-history';

/** Role indices per company, in order of first appearance; a role with no company yet stands alone. */
export function groupByCompany(roles: WorkExperienceInput[]): { roles: number[] }[] {
  const groups = new Map<string, number[]>();
  roles.forEach((role, i) => {
    const key = companyKey(role.company) || `__unnamed-${i}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  return [...groups.values()].map((indices) => ({ roles: indices }));
}

export function isCurrentCompany(workExperiences: WorkExperienceInput[], roles: number[]): boolean {
  return roles.some((i) => workExperiences[i].isCurrent);
}

export function companyValue<K extends 'firmSize' | 'companyUrl'>(
  workExperiences: WorkExperienceInput[],
  roles: number[],
  key: K
): WorkExperienceInput[K] {
  return roles.map((i) => workExperiences[i][key]).find((v) => v) ?? undefined;
}

/**
 * Work-history and education problems, keyed by field id — everything the background step checks
 * except peer references. Shared by the wizard and the admin review editor.
 */
export function backgroundErrors(form: {
  yearsOfExperience: string;
  workExperiences: WorkExperienceInput[];
  educations: EducationInput[];
}): Record<string, string> {
  const e: Record<string, string> = {};
  const workExperiences = shareCompanyWebsites(form.workExperiences);
  if (form.yearsOfExperience === '') e.yearsOfExperience = 'Years of experience is required.';

  groupByCompany(workExperiences).forEach(({ roles }) => {
    const first = roles[0];
    const company = workExperiences[first];
    if (!company.company.trim()) e[`workExperiences.${first}.company`] = 'Company is required.';
    // Only the current company's size and website reach the approved member's profile (firm
    // size, firm website), so they're asked — and required — for it alone. Any URL works for the
    // website, including a LinkedIn company/profile page.
    else if (isCurrentCompany(workExperiences, roles)) {
      if (!companyValue(workExperiences, roles, 'firmSize'))
        e[`workExperiences.${first}.firmSize`] = 'Firm size is required.';
      if (!companyValue(workExperiences, roles, 'companyUrl')?.trim())
        e[`workExperiences.${first}.companyUrl`] = 'Add a website for your current company.';
    }
    for (const i of roles) {
      const w = workExperiences[i];
      if (!w.title.trim()) e[`workExperiences.${i}.title`] = 'Job title is required.';
      else if (!w.startYear) e[`workExperiences.${i}.startYear`] = 'Start year is required.';
    }
  });
  form.workExperiences.forEach((w, i) => {
    if (
      isEndBeforeStart(w) &&
      !e[`workExperiences.${i}.title`] &&
      !e[`workExperiences.${i}.company`] &&
      !e[`workExperiences.${i}.startYear`]
    )
      e[`workExperiences.${i}.dates`] = 'End date is before the start date.';
  });
  // One entry must be marked as the applicant's current position — it becomes the approved
  // member's firm name, so it can't be silently absent (backend enforces this too, at submit).
  if (Object.keys(e).length === 0 && !form.workExperiences.some((w) => w.isCurrent && w.company.trim())) {
    e.workExperiencesCurrent = 'Mark your current position — this becomes your firm name once approved.';
  }
  form.educations.forEach((edu, i) => {
    if (!edu.institution.trim()) e[`educations.${i}.institution`] = 'Institution is required.';
    else if (!edu.degree.trim()) e[`educations.${i}.degree`] = 'Degree is required.';
  });
  return e;
}
