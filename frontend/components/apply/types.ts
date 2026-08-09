import type {
  ApplicationRegion,
  BillingPeriod,
  EducationInput,
  ServicePreferenceInput,
  WorkExperienceInput,
} from '@shared/membership-application';

// Wizard's working state — a superset of CreateApplicationRequest with a few
// fields kept as strings for controlled inputs (numbers, dollars not cents)
// until submit, when WizardForm.toRequest() converts/validates the final shape.
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
