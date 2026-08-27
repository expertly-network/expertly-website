import { useState } from 'react';
import type {
  ApplicationDto,
  ApplicationRegion,
  BillingPeriod,
  EducationInput,
  ServicePreferenceInput,
  UpdateApplicationRequest,
  WorkExperienceInput,
} from '@shared/membership-application';

// Shared across every wizard step: "Next"/"Submit" stays clickable even when required fields are
// empty — clicking it while invalid sets `attempted`, which turns on each empty field's `error`
// prop, instead of silently disabling the button. See docs/design-system.md's Input/Select/
// Textarea `error` prop note for the full rationale.
export const REQUIRED_MSG = 'This field is required.';

/** onInvalid is optional extra work a step needs on a failed attempt (e.g. BackgroundStep
 * auto-expanding collapsed cards that turned out invalid) — most steps don't need it. */
export function useAttemptedNext(canContinue: boolean, onNext: () => void, onInvalid?: () => void) {
  const [attempted, setAttempted] = useState(false);

  function handleNext() {
    if (!canContinue) {
      setAttempted(true);
      onInvalid?.();
      return;
    }
    onNext();
  }

  return { attempted, handleNext };
}

// Wizard's working state — a superset of UpdateApplicationRequest with a few
// fields kept as strings for controlled inputs (numbers, dollars not cents)
// until save/submit, when toUpdateRequest() converts the final shape.
export interface WizardFormState {
  linkedinUrl: string;
  linkedinImportConsent: boolean;
  firstName: string;
  lastName: string;
  contactEmail: string;
  phoneCountryCode: string;
  phone: string;
  region: ApplicationRegion | '';
  country: string;
  state: string;
  city: string;
  bio: string;
  yearsOfExperience: string;
  workExperiences: WorkExperienceInput[];
  educations: EducationInput[];
  servicePreferences: ServicePreferenceInput[];
  rateMinDollars: string;
  rateMaxDollars: string;
  billingPeriod: BillingPeriod;
  couponCode: string;
  backgroundCheckConsent: boolean;
  /** Signed URL for the uploaded profile photo, if any — set by IdentityStep's upload. */
  photoUrl?: string;
  /**
   * Field names (matching this interface's own keys) whose current value came from LinkedIn
   * import and hasn't been edited since. Client-side only, never sent to the backend — purely
   * drives the "imported" badge. A field is removed from this set the moment `update()` changes
   * it, regardless of source.
   */
  importedFields: Set<string>;
}

/** Converts the wizard's controlled-input state into the request shape POST /v1/applications/me
 * expects. Sends the complete current form on every save (not just the fields for "this step") —
 * simpler and safer than a per-step subset: the backend upsert merges fields idempotently, so
 * re-sending unchanged values is harmless, and there's no risk of a field silently never being
 * persisted because it belonged to an earlier step. */
function nonEmptyOrUndefined<T>(items: T[]): T[] | undefined {
  return items.length > 0 ? items : undefined;
}

export function toUpdateRequest(
  form: WizardFormState,
  extra: { currentStep?: number; status?: 'draft' | 'submitted' } = {}
): UpdateApplicationRequest {
  return {
    firstName: form.firstName || undefined,
    lastName: form.lastName || undefined,
    contactEmail: form.contactEmail || undefined,
    phoneCountryCode: form.phone ? form.phoneCountryCode : undefined,
    phone: form.phone || undefined,
    region: form.region || undefined,
    country: form.country || undefined,
    state: form.state || undefined,
    city: form.city || undefined,
    linkedinUrl: form.linkedinUrl || undefined,
    bio: form.bio || undefined,
    yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
    // Both arrays start as a single untouched blank template entry (INITIAL_WIZARD_STATE) until
    // the applicant reaches Background — sending that placeholder as-is 400s on the very first
    // save (title/company/institution/degree are @IsNotEmpty() per-entry on the backend even
    // though the array itself is optional). Filter out entries with no real content, and omit
    // the field entirely once nothing's left, so an early save on step 1/2 doesn't trip
    // Background's own validation before the applicant has gotten there.
    //
    // companyUrl is IsOptional + IsUrl on the backend (deliberately deferred to submit-time
    // completeness, not per-save — LinkedIn import leaves it blank and auto-saves immediately
    // after import, before the applicant can fill it in manually) — class-validator's IsOptional
    // only skips null/undefined, not '', so the empty-string default from EMPTY_WORK_EXPERIENCE
    // (and LinkedIn-imported entries) must be scrubbed here.
    workExperiences: nonEmptyOrUndefined(
      form.workExperiences
        .filter((w) => w.title.trim() || w.company.trim())
        .map((w) => ({ ...w, companyUrl: w.companyUrl || undefined }))
    ),
    educations: nonEmptyOrUndefined(
      form.educations.filter((e) => e.institution.trim() || e.degree.trim())
    ),
    servicePreferences: form.servicePreferences,
    rateMinCents: form.rateMinDollars ? Math.round(Number(form.rateMinDollars) * 100) : undefined,
    rateMaxCents: form.rateMaxDollars ? Math.round(Number(form.rateMaxDollars) * 100) : undefined,
    billingPeriod: form.billingPeriod,
    couponCode: form.couponCode || undefined,
    linkedinImportConsent: form.linkedinImportConsent,
    backgroundCheckConsent: form.backgroundCheckConsent || undefined,
    // Fixed current-version constants — same value on every save, harmless to send early; the
    // backend only actually requires them once status: 'submitted' is sent (see assertComplete).
    termsVersionAgreed: TERMS_VERSION,
    privacyVersionAgreed: PRIVACY_VERSION,
    ...extra,
  };
}

/** Inverse of toUpdateRequest — seeds WizardFormState from a resumed draft. Null/absent DTO
 * fields fall back to the same empty defaults INITIAL_WIZARD_STATE uses, not undefined, so every
 * input stays a controlled component. */
export function fromDto(app: ApplicationDto): Partial<WizardFormState> {
  return {
    linkedinUrl: app.linkedinUrl ?? '',
    photoUrl: app.photoUrl ?? undefined,
    firstName: app.firstName ?? '',
    lastName: app.lastName ?? '',
    contactEmail: app.contactEmail ?? '',
    phoneCountryCode: app.phoneCountryCode ?? '+1',
    phone: app.phone ?? '',
    region: app.region ?? '',
    country: app.country ?? '',
    state: app.state ?? '',
    city: app.city ?? '',
    bio: app.bio ?? '',
    yearsOfExperience: app.yearsOfExperience != null ? String(app.yearsOfExperience) : '',
    workExperiences: app.workExperiences.length > 0 ? app.workExperiences : [{ ...EMPTY_WORK_EXPERIENCE }],
    educations: app.educations.length > 0 ? app.educations : [{ ...EMPTY_EDUCATION }],
    servicePreferences: app.servicePreferences.map((p) => ({
      practiceAreaId: p.practiceAreaId,
      priority: p.priority,
    })),
    rateMinDollars: app.rateMinCents != null ? String(app.rateMinCents / 100) : '',
    rateMaxDollars: app.rateMaxCents != null ? String(app.rateMaxCents / 100) : '',
    billingPeriod: app.billingPeriod ?? 'annual',
    couponCode: app.couponCode ?? '',
  };
}

export const TERMS_VERSION = '1.0';
export const PRIVACY_VERSION = '1.0';

export const EMPTY_WORK_EXPERIENCE: WorkExperienceInput = {
  title: '',
  company: '',
  city: '',
  companyUrl: '',
  startYear: new Date().getFullYear(),
  isCurrent: false,
};

export const EMPTY_EDUCATION: EducationInput = {
  institution: '',
  degree: '',
  fieldOfStudy: '',
};

export const INITIAL_WIZARD_STATE: WizardFormState = {
  linkedinUrl: '',
  linkedinImportConsent: false,
  firstName: '',
  lastName: '',
  contactEmail: '',
  phoneCountryCode: '+1',
  phone: '',
  region: '',
  country: '',
  state: '',
  city: '',
  bio: '',
  yearsOfExperience: '',
  workExperiences: [{ ...EMPTY_WORK_EXPERIENCE }],
  educations: [{ ...EMPTY_EDUCATION }],
  servicePreferences: [],
  rateMinDollars: '',
  rateMaxDollars: '',
  billingPeriod: 'annual',
  couponCode: '',
  backgroundCheckConsent: false,
  importedFields: new Set(),
};

export const REGIONS: { value: ApplicationRegion; label: string }[] = [
  { value: 'asia_pacific', label: 'Asia Pacific' },
  { value: 'europe', label: 'Europe' },
  { value: 'latin_america', label: 'Latin America' },
  { value: 'middle_east', label: 'Middle East' },
  { value: 'north_america', label: 'North America' },
  { value: 'south_asia', label: 'South Asia' },
  { value: 'africa', label: 'Africa' },
];

export const COUNTRIES = [
  'India', 'Singapore', 'United Kingdom', 'United States', 'United Arab Emirates',
  'Germany', 'France', 'Italy', 'Spain', 'Japan', 'Australia', 'Canada',
  'Brazil', 'China', 'Ghana', 'Nigeria', 'Egypt', 'South Africa', 'Other',
];

export const PHONE_CODES = [
  '+1', '+44', '+91', '+971', '+65', '+61', '+49', '+33', '+81', '+234', '+27', '+55', '+86', '+7',
];

export const FIRM_SIZES: { value: NonNullable<WorkExperienceInput['firmSize']>; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: '2_10', label: '2–10' },
  { value: '11_50', label: '11–50' },
  { value: '51_200', label: '51–200' },
  { value: '200_plus', label: '200+' },
];
