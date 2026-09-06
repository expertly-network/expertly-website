import type {
  ApplicationDto,
  ApplicationRegion,
  BillingPeriod,
  EducationInput,
  PeerReferenceInput,
  ServicePreferenceInput,
  UpdateApplicationRequest,
  WorkExperienceInput,
} from '@shared/membership-application';

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
  /** Always exactly 2 entries in the wizard's own state (unlike work/education, which grow) —
   * see EMPTY_PEER_REFERENCE / INITIAL_WIZARD_STATE. */
  peerReferences: PeerReferenceInput[];
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
    // companyUrl is IsOptional + IsUrl on the backend — class-validator's IsOptional only skips
    // null/undefined, not '', so the empty-string default from EMPTY_WORK_EXPERIENCE must be
    // scrubbed here.
    workExperiences: nonEmptyOrUndefined(
      form.workExperiences
        .filter((w) => w.title.trim() || w.company.trim())
        .map((w) => ({ ...w, companyUrl: w.companyUrl || undefined }))
    ),
    educations: nonEmptyOrUndefined(
      form.educations.filter((e) => e.institution.trim() || e.degree.trim())
    ),
    // Same "filter out the still-blank template" reasoning as work/education above — an early
    // save before the applicant reaches this section shouldn't send two empty reference objects.
    peerReferences: nonEmptyOrUndefined(
      form.peerReferences.filter((r) => r.name.trim() || r.email.trim())
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
    peerReferences:
      app.peerReferences.length === 2
        ? app.peerReferences
        : [{ ...EMPTY_PEER_REFERENCE }, { ...EMPTY_PEER_REFERENCE }],
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

export const EMPTY_PEER_REFERENCE: PeerReferenceInput = {
  name: '',
  relationship: '',
  email: '',
  phone: '',
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
  peerReferences: [{ ...EMPTY_PEER_REFERENCE }, { ...EMPTY_PEER_REFERENCE }],
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

// Deliberately not a smaller "common codes" shortlist per 2026-08-31 client feedback ("the
// dropdown should include all country codes") — every ITU-assigned calling code, one entry per
// country/territory, sorted by country name. Several countries share a calling code (e.g. +1
// for the US/Canada/Caribbean, +7 for Russia/Kazakhstan) — the form only ever stores the bare
// code (`phoneCountryCode`), same as before this change, so those still collapse to the same
// value; only the option label disambiguates which country the applicant picked.
export const PHONE_COUNTRY_CODES: { country: string; code: string }[] = [
  { country: 'Afghanistan', code: '+93' },
  { country: 'Albania', code: '+355' },
  { country: 'Algeria', code: '+213' },
  { country: 'American Samoa', code: '+1' },
  { country: 'Andorra', code: '+376' },
  { country: 'Angola', code: '+244' },
  { country: 'Anguilla', code: '+1' },
  { country: 'Antigua and Barbuda', code: '+1' },
  { country: 'Argentina', code: '+54' },
  { country: 'Armenia', code: '+374' },
  { country: 'Aruba', code: '+297' },
  { country: 'Australia', code: '+61' },
  { country: 'Austria', code: '+43' },
  { country: 'Azerbaijan', code: '+994' },
  { country: 'Bahamas', code: '+1' },
  { country: 'Bahrain', code: '+973' },
  { country: 'Bangladesh', code: '+880' },
  { country: 'Barbados', code: '+1' },
  { country: 'Belarus', code: '+375' },
  { country: 'Belgium', code: '+32' },
  { country: 'Belize', code: '+501' },
  { country: 'Benin', code: '+229' },
  { country: 'Bermuda', code: '+1' },
  { country: 'Bhutan', code: '+975' },
  { country: 'Bolivia', code: '+591' },
  { country: 'Bosnia and Herzegovina', code: '+387' },
  { country: 'Botswana', code: '+267' },
  { country: 'Brazil', code: '+55' },
  { country: 'British Virgin Islands', code: '+1' },
  { country: 'Brunei', code: '+673' },
  { country: 'Bulgaria', code: '+359' },
  { country: 'Burkina Faso', code: '+226' },
  { country: 'Burundi', code: '+257' },
  { country: 'Cambodia', code: '+855' },
  { country: 'Cameroon', code: '+237' },
  { country: 'Canada', code: '+1' },
  { country: 'Cape Verde', code: '+238' },
  { country: 'Cayman Islands', code: '+1' },
  { country: 'Central African Republic', code: '+236' },
  { country: 'Chad', code: '+235' },
  { country: 'Chile', code: '+56' },
  { country: 'China', code: '+86' },
  { country: 'Colombia', code: '+57' },
  { country: 'Comoros', code: '+269' },
  { country: 'Congo (DRC)', code: '+243' },
  { country: 'Congo (Republic)', code: '+242' },
  { country: 'Cook Islands', code: '+682' },
  { country: 'Costa Rica', code: '+506' },
  { country: "Côte d'Ivoire", code: '+225' },
  { country: 'Croatia', code: '+385' },
  { country: 'Cuba', code: '+53' },
  { country: 'Curaçao', code: '+599' },
  { country: 'Cyprus', code: '+357' },
  { country: 'Czech Republic', code: '+420' },
  { country: 'Denmark', code: '+45' },
  { country: 'Djibouti', code: '+253' },
  { country: 'Dominica', code: '+1' },
  { country: 'Dominican Republic', code: '+1' },
  { country: 'Ecuador', code: '+593' },
  { country: 'Egypt', code: '+20' },
  { country: 'El Salvador', code: '+503' },
  { country: 'Equatorial Guinea', code: '+240' },
  { country: 'Eritrea', code: '+291' },
  { country: 'Estonia', code: '+372' },
  { country: 'Eswatini', code: '+268' },
  { country: 'Ethiopia', code: '+251' },
  { country: 'Falkland Islands', code: '+500' },
  { country: 'Faroe Islands', code: '+298' },
  { country: 'Fiji', code: '+679' },
  { country: 'Finland', code: '+358' },
  { country: 'France', code: '+33' },
  { country: 'French Guiana', code: '+594' },
  { country: 'French Polynesia', code: '+689' },
  { country: 'Gabon', code: '+241' },
  { country: 'Gambia', code: '+220' },
  { country: 'Georgia', code: '+995' },
  { country: 'Germany', code: '+49' },
  { country: 'Ghana', code: '+233' },
  { country: 'Gibraltar', code: '+350' },
  { country: 'Greece', code: '+30' },
  { country: 'Greenland', code: '+299' },
  { country: 'Grenada', code: '+1' },
  { country: 'Guadeloupe', code: '+590' },
  { country: 'Guam', code: '+1' },
  { country: 'Guatemala', code: '+502' },
  { country: 'Guernsey', code: '+44' },
  { country: 'Guinea', code: '+224' },
  { country: 'Guinea-Bissau', code: '+245' },
  { country: 'Guyana', code: '+592' },
  { country: 'Haiti', code: '+509' },
  { country: 'Honduras', code: '+504' },
  { country: 'Hong Kong', code: '+852' },
  { country: 'Hungary', code: '+36' },
  { country: 'Iceland', code: '+354' },
  { country: 'India', code: '+91' },
  { country: 'Indonesia', code: '+62' },
  { country: 'Iran', code: '+98' },
  { country: 'Iraq', code: '+964' },
  { country: 'Ireland', code: '+353' },
  { country: 'Isle of Man', code: '+44' },
  { country: 'Israel', code: '+972' },
  { country: 'Italy', code: '+39' },
  { country: 'Jamaica', code: '+1' },
  { country: 'Japan', code: '+81' },
  { country: 'Jersey', code: '+44' },
  { country: 'Jordan', code: '+962' },
  { country: 'Kazakhstan', code: '+7' },
  { country: 'Kenya', code: '+254' },
  { country: 'Kiribati', code: '+686' },
  { country: 'Kosovo', code: '+383' },
  { country: 'Kuwait', code: '+965' },
  { country: 'Kyrgyzstan', code: '+996' },
  { country: 'Laos', code: '+856' },
  { country: 'Latvia', code: '+371' },
  { country: 'Lebanon', code: '+961' },
  { country: 'Lesotho', code: '+266' },
  { country: 'Liberia', code: '+231' },
  { country: 'Libya', code: '+218' },
  { country: 'Liechtenstein', code: '+423' },
  { country: 'Lithuania', code: '+370' },
  { country: 'Luxembourg', code: '+352' },
  { country: 'Macau', code: '+853' },
  { country: 'Madagascar', code: '+261' },
  { country: 'Malawi', code: '+265' },
  { country: 'Malaysia', code: '+60' },
  { country: 'Maldives', code: '+960' },
  { country: 'Mali', code: '+223' },
  { country: 'Malta', code: '+356' },
  { country: 'Marshall Islands', code: '+692' },
  { country: 'Martinique', code: '+596' },
  { country: 'Mauritania', code: '+222' },
  { country: 'Mauritius', code: '+230' },
  { country: 'Mayotte', code: '+262' },
  { country: 'Mexico', code: '+52' },
  { country: 'Micronesia', code: '+691' },
  { country: 'Moldova', code: '+373' },
  { country: 'Monaco', code: '+377' },
  { country: 'Mongolia', code: '+976' },
  { country: 'Montenegro', code: '+382' },
  { country: 'Montserrat', code: '+1' },
  { country: 'Morocco', code: '+212' },
  { country: 'Mozambique', code: '+258' },
  { country: 'Myanmar', code: '+95' },
  { country: 'Namibia', code: '+264' },
  { country: 'Nauru', code: '+674' },
  { country: 'Nepal', code: '+977' },
  { country: 'Netherlands', code: '+31' },
  { country: 'New Caledonia', code: '+687' },
  { country: 'New Zealand', code: '+64' },
  { country: 'Nicaragua', code: '+505' },
  { country: 'Niger', code: '+227' },
  { country: 'Nigeria', code: '+234' },
  { country: 'Niue', code: '+683' },
  { country: 'North Korea', code: '+850' },
  { country: 'North Macedonia', code: '+389' },
  { country: 'Norway', code: '+47' },
  { country: 'Oman', code: '+968' },
  { country: 'Pakistan', code: '+92' },
  { country: 'Palau', code: '+680' },
  { country: 'Palestine', code: '+970' },
  { country: 'Panama', code: '+507' },
  { country: 'Papua New Guinea', code: '+675' },
  { country: 'Paraguay', code: '+595' },
  { country: 'Peru', code: '+51' },
  { country: 'Philippines', code: '+63' },
  { country: 'Poland', code: '+48' },
  { country: 'Portugal', code: '+351' },
  { country: 'Puerto Rico', code: '+1' },
  { country: 'Qatar', code: '+974' },
  { country: 'Réunion', code: '+262' },
  { country: 'Romania', code: '+40' },
  { country: 'Russia', code: '+7' },
  { country: 'Rwanda', code: '+250' },
  { country: 'Saint Kitts and Nevis', code: '+1' },
  { country: 'Saint Lucia', code: '+1' },
  { country: 'Saint Vincent and the Grenadines', code: '+1' },
  { country: 'Samoa', code: '+685' },
  { country: 'San Marino', code: '+378' },
  { country: 'São Tomé and Príncipe', code: '+239' },
  { country: 'Saudi Arabia', code: '+966' },
  { country: 'Senegal', code: '+221' },
  { country: 'Serbia', code: '+381' },
  { country: 'Seychelles', code: '+248' },
  { country: 'Sierra Leone', code: '+232' },
  { country: 'Singapore', code: '+65' },
  { country: 'Slovakia', code: '+421' },
  { country: 'Slovenia', code: '+386' },
  { country: 'Solomon Islands', code: '+677' },
  { country: 'Somalia', code: '+252' },
  { country: 'South Africa', code: '+27' },
  { country: 'South Korea', code: '+82' },
  { country: 'South Sudan', code: '+211' },
  { country: 'Spain', code: '+34' },
  { country: 'Sri Lanka', code: '+94' },
  { country: 'Sudan', code: '+249' },
  { country: 'Suriname', code: '+597' },
  { country: 'Sweden', code: '+46' },
  { country: 'Switzerland', code: '+41' },
  { country: 'Syria', code: '+963' },
  { country: 'Taiwan', code: '+886' },
  { country: 'Tajikistan', code: '+992' },
  { country: 'Tanzania', code: '+255' },
  { country: 'Thailand', code: '+66' },
  { country: 'Timor-Leste', code: '+670' },
  { country: 'Togo', code: '+228' },
  { country: 'Tonga', code: '+676' },
  { country: 'Trinidad and Tobago', code: '+1' },
  { country: 'Tunisia', code: '+216' },
  { country: 'Turkey', code: '+90' },
  { country: 'Turkmenistan', code: '+993' },
  { country: 'Turks and Caicos Islands', code: '+1' },
  { country: 'Tuvalu', code: '+688' },
  { country: 'Uganda', code: '+256' },
  { country: 'Ukraine', code: '+380' },
  { country: 'United Arab Emirates', code: '+971' },
  { country: 'United Kingdom', code: '+44' },
  { country: 'United States', code: '+1' },
  { country: 'Uruguay', code: '+598' },
  { country: 'Uzbekistan', code: '+998' },
  { country: 'Vanuatu', code: '+678' },
  { country: 'Vatican City', code: '+379' },
  { country: 'Venezuela', code: '+58' },
  { country: 'Vietnam', code: '+84' },
  { country: 'Yemen', code: '+967' },
  { country: 'Zambia', code: '+260' },
  { country: 'Zimbabwe', code: '+263' },
];

export const FIRM_SIZES: { value: NonNullable<WorkExperienceInput['firmSize']>; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: '2_10', label: '2–10' },
  { value: '11_50', label: '11–50' },
  { value: '51_200', label: '51–200' },
  { value: '200_plus', label: '200+' },
];
