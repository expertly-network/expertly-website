export type ApplicationStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';

export type ApplicationRegion =
  | 'asia_pacific'
  | 'europe'
  | 'latin_america'
  | 'middle_east'
  | 'north_america'
  | 'south_asia'
  | 'africa';

export type FirmSize = 'solo' | '2_10' | '11_50' | '51_200' | '200_plus';

// Auto-derived server-side from yearsOfExperience at submission — never
// accepted from the client. See POST /v1/applications in docs/rest-api.md.
export type MembershipTier = 'budding_entrepreneur' | 'seasoned_professional';

export type BillingPeriod = 'monthly' | 'annual';

// Only 'waived' is reachable without a real payment gateway; 'paid' is
// reserved for when one gets integrated.
export type PaymentStatus = 'pending' | 'waived' | 'paid';

export interface WorkExperienceInput {
  title: string;
  company: string;
  city?: string;
  firmSize?: FirmSize;
  companyUrl?: string;
  startMonth?: number; // 1-12
  startYear: number;
  endMonth?: number; // 1-12, omit if isCurrent
  endYear?: number; // omit if isCurrent
  isCurrent: boolean;
}

export interface EducationInput {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
}

export interface ServicePreferenceInput {
  practiceAreaId: string;
  priority: 1 | 2 | 3;
}

export interface ServicePreference extends ServicePreferenceInput {
  /** Resolved server-side for display — not required on input. */
  practiceAreaName: string;
}

/** POST /v1/applications request body. */
export interface CreateApplicationRequest {
  photoUrl?: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  phoneCountryCode?: string;
  phone?: string;
  region: ApplicationRegion;
  country: string;
  state?: string;
  city?: string;
  linkedinUrl: string;
  bio: string;
  yearsOfExperience: number;
  workExperiences: WorkExperienceInput[];
  educations: EducationInput[];
  servicePreferences: ServicePreferenceInput[];
  rateMinCents: number;
  rateMaxCents: number;
  billingPeriod: BillingPeriod;
  /** Free text, validated server-side. Omit or send an invalid code for no discount. */
  couponCode?: string;
  linkedinImportConsent: boolean;
  termsVersionAgreed: string;
  privacyVersionAgreed: string;
  backgroundCheckConsent: boolean;
}

/** Response shape for POST /v1/applications (201) and GET /v1/applications/me (200). */
export interface ApplicationDto {
  id: string;
  status: ApplicationStatus;
  photoUrl: string | null;
  firstName: string;
  lastName: string;
  contactEmail: string;
  phoneCountryCode: string | null;
  phone: string | null;
  region: ApplicationRegion;
  country: string;
  state: string | null;
  city: string | null;
  linkedinUrl: string;
  bio: string;
  yearsOfExperience: number;
  workExperiences: WorkExperienceInput[];
  educations: EducationInput[];
  servicePreferences: ServicePreference[];
  rateMinCents: number;
  rateMaxCents: number;
  selectedTier: MembershipTier;
  billingPeriod: BillingPeriod;
  listPriceCents: number;
  couponCode: string | null;
  discountAmountCents: number;
  amountDueCents: number;
  paymentStatus: PaymentStatus;
  createdAt: string;
}
