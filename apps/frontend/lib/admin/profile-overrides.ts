import type { ApplicationDto, ApplicationProfileOverrides } from '@shared/membership-application';
import { INITIAL_WIZARD_STATE, fromDto, toUpdateRequest, type WizardFormState } from '@/components/apply/types';

export const OVERRIDE_KEYS = [
  'firstName',
  'lastName',
  'contactEmail',
  'workEmail',
  'phoneCountryCode',
  'phone',
  'country',
  'state',
  'city',
  'linkedinUrl',
  'bio',
  'yearsOfExperience',
  'rateMinCents',
  'rateMaxCents',
  'workExperiences',
  'educations',
] as const satisfies readonly (keyof ApplicationProfileOverrides)[];

/** The application as an editable form — same state shape (and field components) as the wizard. */
export function formFromApplication(app: ApplicationDto): WizardFormState {
  return { ...INITIAL_WIZARD_STATE, ...fromDto(app), importedFields: new Set<string>() };
}

/**
 * Only what the admin changed, compared through the wizard's own form → request mapping on both
 * sides so formatting differences (cents vs dollars, blank template rows) never count as edits.
 * Clearing a field isn't expressible (the mapping turns '' into "omitted"), so it isn't sent.
 */
export function profileOverrides(original: ApplicationDto, edited: WizardFormState): ApplicationProfileOverrides {
  const before = toUpdateRequest(formFromApplication(original));
  const after = toUpdateRequest(edited);
  const out: Record<string, unknown> = {};
  for (const key of OVERRIDE_KEYS) {
    if (after[key] !== undefined && JSON.stringify(after[key]) !== JSON.stringify(before[key])) out[key] = after[key];
  }
  return out as ApplicationProfileOverrides;
}
