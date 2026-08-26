export type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';

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
// accepted from the client. See POST /v1/applications/me in docs/rest-api.md.
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

/**
 * POST /v1/applications/me request body — an upsert. Every field is optional: a draft can be
 * arbitrarily incomplete, and each call only needs to carry the fields that changed. Set
 * `status: 'submitted'` to attempt the draft -> submitted transition (the backend then requires
 * every field below except couponCode to be present, on the merged row, not just this call's
 * body).
 */
export interface UpdateApplicationRequest {
  firstName?: string;
  lastName?: string;
  contactEmail?: string;
  phoneCountryCode?: string;
  phone?: string;
  region?: ApplicationRegion;
  country?: string;
  state?: string;
  city?: string;
  linkedinUrl?: string;
  bio?: string;
  yearsOfExperience?: number;
  workExperiences?: WorkExperienceInput[];
  educations?: EducationInput[];
  servicePreferences?: ServicePreferenceInput[];
  rateMinCents?: number;
  rateMaxCents?: number;
  billingPeriod?: BillingPeriod;
  /** Free text, validated server-side. Omit or send an invalid code for no discount. */
  couponCode?: string;
  linkedinImportConsent?: boolean;
  termsVersionAgreed?: string;
  privacyVersionAgreed?: string;
  backgroundCheckConsent?: boolean;
  /** Which wizard step to resume on next load. Purely a UX convenience, not validated. */
  currentStep?: number;
  /** Omit or 'draft' to just save progress. 'submitted' triggers full validation + transition. */
  status?: 'draft' | 'submitted';
}

export interface ApplicationDocumentDto {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Signed URL, minted fresh on every read — not stable, don't cache long-term. */
  url: string;
  uploadedAt: string;
}

/** Response shape for POST /v1/applications/me (200) and GET /v1/applications/me (200). */
export interface ApplicationDto {
  id: string;
  status: ApplicationStatus;
  currentStep: number;
  /** Signed URL, minted fresh on every read — not stable, don't cache long-term. */
  photoUrl: string | null;
  documents: ApplicationDocumentDto[];
  firstName: string | null;
  lastName: string | null;
  contactEmail: string | null;
  phoneCountryCode: string | null;
  phone: string | null;
  region: ApplicationRegion | null;
  country: string | null;
  state: string | null;
  city: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  workExperiences: WorkExperienceInput[];
  educations: EducationInput[];
  servicePreferences: ServicePreference[];
  rateMinCents: number | null;
  rateMaxCents: number | null;
  selectedTier: MembershipTier | null;
  billingPeriod: BillingPeriod | null;
  listPriceCents: number | null;
  couponCode: string | null;
  discountAmountCents: number | null;
  amountDueCents: number | null;
  paymentStatus: PaymentStatus | null;
  createdAt: string;
}

export interface LinkedInImportRequest {
  linkedinUrl: string;
}

/**
 * Normalized LinkedIn-import result — every field optional, since anything that couldn't be
 * extracted is simply omitted (the applicant fills it manually). Backed by the real n8n-backed
 * provider (apps/backend/src/applications/linkedin-import/n8n-linkedin-import.provider.ts) when
 * configured, the deterministic mock provider otherwise — see that module for which fields each
 * one actually populates.
 */
export interface LinkedInImportResponse {
  firstName?: string;
  lastName?: string;
  bio?: string;
  yearsOfExperience?: number;
  workExperiences?: WorkExperienceInput[];
  educations?: EducationInput[];
  country?: string;
  state?: string;
  city?: string;
}

/** PATCH /v1/admin/applications/:id request body. */
export interface AdminApplicationReviewRequest {
  status: 'approved' | 'rejected';
  /** Required when status is 'rejected'. */
  rejectionReason?: string;
}
