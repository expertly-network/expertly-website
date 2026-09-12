import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';

export type ApplicationRegion =
  | 'asia_pacific'
  | 'europe'
  | 'latin_america'
  | 'middle_east'
  | 'north_america'
  | 'south_asia'
  | 'africa';

const APPLICATION_REGIONS = [
  'asia_pacific',
  'europe',
  'latin_america',
  'middle_east',
  'north_america',
  'south_asia',
  'africa',
];

export type FirmSize = 'solo' | '2_10' | '11_50' | '51_200' | '200_plus';

// Derived server-side from years of experience at submission; never accepted from the client.
export type MembershipTier = 'budding_entrepreneur' | 'seasoned_professional';

// Annual-only for now.
export type BillingPeriod = 'annual';

// 'paid' is reserved for a future real payment gateway.
export type PaymentStatus = 'pending' | 'waived' | 'paid';

export class WorkExperienceInput {
  @ApiProperty() title!: string;
  @ApiProperty() company!: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional({ enum: ['solo', '2_10', '11_50', '51_200', '200_plus'] }) firmSize?: FirmSize;
  @ApiPropertyOptional() companyUrl?: string;
  @ApiPropertyOptional() startMonth?: number; // 1-12
  @ApiProperty() startYear!: number;
  @ApiPropertyOptional() endMonth?: number; // 1-12, omit if isCurrent
  @ApiPropertyOptional() endYear?: number; // omit if isCurrent
  @ApiProperty() isCurrent!: boolean;
}

export class EducationInput {
  @ApiProperty() institution!: string;
  @ApiProperty() degree!: string;
  @ApiPropertyOptional() fieldOfStudy?: string;
  @ApiPropertyOptional() startYear?: number;
  @ApiPropertyOptional() endYear?: number;
}

export class ServicePreferenceInput {
  @ApiProperty() practiceAreaId!: string;
  @ApiProperty({ enum: [1, 2, 3] }) priority!: 1 | 2 | 3;
}

export class ServicePreference extends ServicePreferenceInput {
  /** Resolved server-side for display — not required on input. */
  @ApiProperty() practiceAreaName!: string;
}

/** A peer reference for the verification process. Exactly two required to submit. */
export class PeerReferenceInput {
  @ApiProperty() name!: string;
  @ApiProperty() relationship!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional() phone?: string;
}

/** POST /v1/applications/me request body — an upsert; every field is optional. */
export class UpdateApplicationRequest {
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() contactEmail?: string;
  @ApiPropertyOptional() phoneCountryCode?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional({ enum: APPLICATION_REGIONS }) region?: ApplicationRegion;
  @ApiPropertyOptional() country?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() linkedinUrl?: string;
  @ApiPropertyOptional() bio?: string;
  @ApiPropertyOptional() yearsOfExperience?: number;
  @ApiPropertyOptional({ type: () => WorkExperienceInput, isArray: true }) workExperiences?: WorkExperienceInput[];
  @ApiPropertyOptional({ type: () => EducationInput, isArray: true }) educations?: EducationInput[];
  /** Exactly 2 required to submit; a draft may have 0 or 1. */
  @ApiPropertyOptional({ type: () => PeerReferenceInput, isArray: true }) peerReferences?: PeerReferenceInput[];
  @ApiPropertyOptional({ type: () => ServicePreferenceInput, isArray: true }) servicePreferences?: ServicePreferenceInput[];
  @ApiPropertyOptional() rateMinCents?: number;
  @ApiPropertyOptional() rateMaxCents?: number;
  @ApiPropertyOptional({ enum: ['annual'] }) billingPeriod?: BillingPeriod;
  /** Free text, validated server-side. Omit or send an invalid code for no discount. */
  @ApiPropertyOptional() couponCode?: string;
  @ApiPropertyOptional() linkedinImportConsent?: boolean;
  @ApiPropertyOptional() termsVersionAgreed?: string;
  @ApiPropertyOptional() privacyVersionAgreed?: string;
  @ApiPropertyOptional() backgroundCheckConsent?: boolean;
  /** Which wizard step to resume on next load. Purely a UX convenience, not validated. */
  @ApiPropertyOptional() currentStep?: number;
  /** Omit or 'draft' to just save progress. 'submitted' triggers full validation + transition. */
  @ApiPropertyOptional({ enum: ['draft', 'submitted'] }) status?: 'draft' | 'submitted';
}

export class ApplicationDocumentDto {
  @ApiProperty() id!: string;
  @ApiProperty() filename!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  /** Signed URL, minted fresh on every read — not stable, don't cache long-term. */
  @ApiProperty() url!: string;
  @ApiProperty() uploadedAt!: string;
}

/** Response shape for POST /v1/applications/me (200) and GET /v1/applications/me (200). */
export class ApplicationDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected'] }) status!: ApplicationStatus;
  @ApiProperty() currentStep!: number;
  /** Signed URL, minted fresh on every read — not stable, don't cache long-term. */
  @ApiProperty({ nullable: true, type: String }) photoUrl!: string | null;
  @ApiProperty({ type: () => ApplicationDocumentDto, isArray: true }) documents!: ApplicationDocumentDto[];
  @ApiProperty({ nullable: true, type: String }) firstName!: string | null;
  @ApiProperty({ nullable: true, type: String }) lastName!: string | null;
  @ApiProperty({ nullable: true, type: String }) contactEmail!: string | null;
  @ApiProperty({ nullable: true, type: String }) phoneCountryCode!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ nullable: true, enum: APPLICATION_REGIONS }) region!: ApplicationRegion | null;
  @ApiProperty({ nullable: true, type: String }) country!: string | null;
  @ApiProperty({ nullable: true, type: String }) state!: string | null;
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
  @ApiProperty({ nullable: true, type: String }) linkedinUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) bio!: string | null;
  @ApiProperty({ nullable: true, type: Number }) yearsOfExperience!: number | null;
  @ApiProperty({ type: () => WorkExperienceInput, isArray: true }) workExperiences!: WorkExperienceInput[];
  @ApiProperty({ type: () => EducationInput, isArray: true }) educations!: EducationInput[];
  @ApiProperty({ type: () => PeerReferenceInput, isArray: true }) peerReferences!: PeerReferenceInput[];
  @ApiProperty({ type: () => ServicePreference, isArray: true }) servicePreferences!: ServicePreference[];
  @ApiProperty({ nullable: true, type: Number }) rateMinCents!: number | null;
  @ApiProperty({ nullable: true, type: Number }) rateMaxCents!: number | null;
  @ApiProperty({ nullable: true, enum: ['budding_entrepreneur', 'seasoned_professional'] }) selectedTier!: MembershipTier | null;
  @ApiProperty({ nullable: true, enum: ['annual'] }) billingPeriod!: BillingPeriod | null;
  @ApiProperty({ nullable: true, type: Number }) listPriceCents!: number | null;
  @ApiProperty({ nullable: true, type: String }) couponCode!: string | null;
  @ApiProperty({ nullable: true, type: Number }) discountAmountCents!: number | null;
  @ApiProperty({ nullable: true, type: Number }) amountDueCents!: number | null;
  @ApiProperty({ nullable: true, enum: ['pending', 'waived', 'paid'] }) paymentStatus!: PaymentStatus | null;
  @ApiProperty() createdAt!: string;
}

export class LinkedInImportRequest {
  @ApiProperty() linkedinUrl!: string;
}

/** Normalized LinkedIn-import result — fields are omitted when extraction fails. */
export class LinkedInImportResponse {
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() bio?: string;
  @ApiPropertyOptional() yearsOfExperience?: number;
  @ApiPropertyOptional({ type: () => WorkExperienceInput, isArray: true }) workExperiences?: WorkExperienceInput[];
  @ApiPropertyOptional({ type: () => EducationInput, isArray: true }) educations?: EducationInput[];
  @ApiPropertyOptional() country?: string;
  @ApiPropertyOptional() state?: string;
  @ApiPropertyOptional() city?: string;
}

/** PATCH /v1/admin/applications/:id request body. */
export class AdminApplicationReviewRequest {
  @ApiProperty({ enum: ['approved', 'rejected'] }) status!: 'approved' | 'rejected';
  /** Required when status is 'rejected'. */
  @ApiPropertyOptional() rejectionReason?: string;
}

/** GET /v1/admin/applications response row — lighter than the full ApplicationDto. */
export class AdminApplicationListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected'] })
  status!: ApplicationStatus;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() contactEmail!: string;
  @ApiProperty() country!: string;
  @ApiProperty({ nullable: true, type: String }) selectedTier!: MembershipTier | null;
  @ApiProperty({ nullable: true, type: String }) billingPeriod!: BillingPeriod | null;
  @ApiProperty({ nullable: true, type: Number }) amountDueCents!: number | null;
  @ApiProperty({ enum: ['pending', 'waived', 'paid'] }) paymentStatus!: PaymentStatus;
  @ApiProperty() createdAt!: string;
}
