import type { MembershipTier } from '@shared/membership-application';
import type { ApplicationRow } from './applications.repository';
import type { ProfileOverridesDto } from './dto/profile-overrides.dto';
import { computeTier } from './constants/pricing';
import { deriveRegion } from './constants/country-region';

const COLUMN: { [K in keyof Required<ProfileOverridesDto>]: keyof ApplicationRow } = {
  firstName: 'first_name',
  lastName: 'last_name',
  contactEmail: 'contact_email',
  workEmail: 'work_email',
  phoneCountryCode: 'phone_country_code',
  phone: 'phone',
  country: 'country',
  state: 'state',
  city: 'city',
  linkedinUrl: 'linkedin_url',
  bio: 'bio',
  yearsOfExperience: 'years_of_experience',
  rateMinCents: 'rate_min_cents',
  rateMaxCents: 'rate_max_cents',
  workExperiences: 'work_experiences',
  educations: 'educations',
};

/** The application as the member profile should see it: a copy with the admin's corrections on top. */
export function applyProfileOverrides(row: ApplicationRow, overrides: ProfileOverridesDto | undefined): ApplicationRow {
  const merged: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === undefined) continue;
    merged[COLUMN[key as keyof ProfileOverridesDto]] = value;
  }
  // Region is never entered directly — re-derive it from a corrected country, as saveOrSubmit does.
  if (overrides?.country !== undefined) merged.region = deriveRegion(overrides.country);
  return merged as unknown as ApplicationRow;
}

/** Explicit admin tier > tier recomputed from corrected years > the applicant's own tier. */
export function resolveMemberTier(
  row: ApplicationRow,
  explicit: MembershipTier | undefined,
  overrides: ProfileOverridesDto | undefined
): MembershipTier | null {
  if (explicit) return explicit;
  if (overrides?.yearsOfExperience !== undefined) return computeTier(overrides.yearsOfExperience);
  return row.selected_tier;
}
