import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ApplicationRegion, MembershipTier } from './membership-application';

const APPLICATION_REGIONS = [
  'asia_pacific',
  'europe',
  'latin_america',
  'middle_east',
  'north_america',
  'south_asia',
  'africa',
];

export type MemberProfileStatus = 'active' | 'deactivated';
export type RenewalPaymentStatus = 'paid' | 'pending' | 'overdue';
export type RenewalDueState = 'active' | 'due-soon' | 'overdue';

export class MemberPracticeArea {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class MemberWorkExperience {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() company!: string;
  @ApiProperty() startYear!: number;
  @ApiProperty({ nullable: true, type: Number }) endYear!: number | null;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
}

export class MemberEducation {
  @ApiProperty() id!: string;
  @ApiProperty() degree!: string;
  @ApiProperty() institution!: string;
  @ApiProperty({ nullable: true, type: String }) field!: string | null;
  @ApiProperty({ nullable: true, type: Number }) endYear!: number | null;
}

export class MemberEngagement {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() organization!: string;
  @ApiProperty({ nullable: true, type: Number }) year!: number | null;
  @ApiProperty({ nullable: true, type: String }) url!: string | null;
}

export class MemberQualification {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: Number }) year!: number | null;
}

export class MemberCredential {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) issuingBody!: string | null;
  @ApiProperty({ nullable: true, type: Number }) year!: number | null;
  @ApiProperty() isVerified!: boolean;
}

export class MemberTestimonial {
  @ApiProperty() id!: string;
  @ApiProperty() quote!: string;
  @ApiProperty() clientName!: string;
  @ApiProperty({ nullable: true, type: String }) clientTitle!: string | null;
  @ApiProperty({ nullable: true, type: String }) clientCompany!: string | null;
  @ApiProperty({ nullable: true, type: String }) serviceName!: string | null;
  @ApiProperty({ nullable: true, type: String }) occurredOn!: string | null;
  @ApiProperty() isVerified!: boolean;
}

export class MemberAward {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true, type: String }) issuingBody!: string | null;
  @ApiProperty({ nullable: true, type: Number }) year!: number | null;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
}

export class MemberKeyClient {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) logoUrl!: string | null;
}

// List-view shape — GET /v1/members. No child arrays, no self-edit state. `bio` IS included
// (unlike the child arrays) — the directory card shows a 2-line excerpt of it
// (`line-clamp-2`), matching design/static_html/members.html's card exactly; truncation is
// client-side, same as the design's own `-webkit-line-clamp` approach.
export class MemberListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() initials!: string;
  @ApiProperty({ nullable: true, type: String }) headline!: string | null;
  @ApiProperty({ nullable: true, type: String }) bio!: string | null;
  @ApiProperty({ nullable: true, type: String }) firmName!: string | null;
  @ApiProperty({ nullable: true, enum: APPLICATION_REGIONS }) region!: ApplicationRegion | null;
  @ApiProperty() country!: string;
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
  @ApiProperty({ type: () => MemberPracticeArea, isArray: true }) practiceAreas!: MemberPracticeArea[];
  @ApiProperty() isVerified!: boolean;
  @ApiProperty({ enum: ['budding_entrepreneur', 'seasoned_professional'] }) memberTier!: MembershipTier;
  @ApiProperty() yearsOfExperience!: number;
  @ApiProperty({ nullable: true, type: Number }) rateMinCents!: number | null;
  @ApiProperty({ nullable: true, type: Number }) rateMaxCents!: number | null;
  @ApiProperty() rateCurrency!: string;
  @ApiProperty({ nullable: true, type: String }) photoUrl!: string | null;
}

// Full detail — GET /v1/members/:id. A member's own published articles are fetched separately via
// GET /v1/articles?authorId=, not embedded here.
export class MemberDto extends MemberListItemDto {
  @ApiProperty({ nullable: true, type: String }) firmWebsite!: string | null;
  @ApiProperty({ nullable: true, type: String }) availabilityNotes!: string | null;
  @ApiProperty() isAvailable!: boolean;
  @ApiProperty({ nullable: true, type: String }) contactEmail!: string | null;
  @ApiProperty({ nullable: true, type: String }) contactPhone!: string | null;
  @ApiProperty({ nullable: true, type: String }) linkedinUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) website!: string | null;
  @ApiProperty({ type: () => MemberWorkExperience, isArray: true }) workExperiences!: MemberWorkExperience[];
  @ApiProperty({ type: () => MemberEducation, isArray: true }) educations!: MemberEducation[];
  @ApiProperty({ type: () => MemberEngagement, isArray: true }) engagements!: MemberEngagement[];
  @ApiProperty({ type: () => MemberQualification, isArray: true }) qualifications!: MemberQualification[];
  @ApiProperty({ type: () => MemberCredential, isArray: true }) credentials!: MemberCredential[];
  @ApiProperty({ type: () => MemberTestimonial, isArray: true }) testimonials!: MemberTestimonial[];
  @ApiProperty({ type: () => MemberAward, isArray: true }) awards!: MemberAward[];
  @ApiProperty({ type: () => MemberKeyClient, isArray: true }) keyClients!: MemberKeyClient[];
}

// Admin-only fields layered on top of the list shape — GET /v1/admin/members.
export class AdminMemberListItemDto extends MemberListItemDto {
  @ApiProperty({ enum: ['active', 'deactivated'] }) status!: MemberProfileStatus;
  @ApiProperty({ nullable: true, type: String }) applicationId!: string | null;
  @ApiProperty() membershipStartedAt!: string;
  @ApiProperty({ nullable: true, enum: ['paid', 'pending', 'overdue'] }) renewalPaymentStatus!: RenewalPaymentStatus | null;
  @ApiProperty({ enum: ['active', 'due-soon', 'overdue'] }) renewalDueState!: RenewalDueState;
}

export class UpdateAdminMemberRequest {
  @ApiPropertyOptional({ enum: ['active', 'deactivated'] }) status?: MemberProfileStatus;
  @ApiPropertyOptional() membershipStartedAt?: string;
  @ApiPropertyOptional({ nullable: true, enum: ['paid', 'pending', 'overdue'] }) renewalPaymentStatus?: RenewalPaymentStatus | null;
}

export class UploadRequest {
  @ApiProperty() fileName!: string;
  @ApiProperty() contentType!: string;
}

export class UploadResponse {
  @ApiProperty() uploadUrl!: string;
  @ApiProperty() path!: string;
}

// ---------------------------------------------------------------------------
// Self-edit moderation queue.
//
// `payload`'s shape depends on `section` — a discriminated union rather than one loose `unknown`,
// so a future frontend session gets real autocomplete/type-checking on each section's submission
// shape instead of having to re-read docs/rest-api.md by hand.
// ---------------------------------------------------------------------------

export type MemberEditSection =
  | 'headline_bio'
  | 'contact'
  | 'engagements'
  | 'education'
  | 'work_experiences'
  | 'key_clients'
  | 'testimonials'
  | 'awards';

export type MemberEditStatus = 'pending' | 'verified' | 'rejected';

export class HeadlineBioEditPayload {
  @ApiProperty() headline!: string;
  @ApiProperty() bio!: string;
}

export class ContactEditPayload {
  @ApiProperty({ nullable: true, type: String }) contactEmail!: string | null;
  @ApiProperty({ nullable: true, type: String }) contactPhone!: string | null;
  @ApiProperty({ nullable: true, type: String }) linkedinUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) website!: string | null;
}

// Proof/asset lives per-item for these sections — embedded directly in each array element, not on
// the edit row (see docs/database-erd.md's proof-requirement-varies-by-section note).
export type EngagementsEditPayload = (Omit<MemberEngagement, 'id'> & { proofFileUrl?: string; proofLink?: string })[];
export type TestimonialsEditPayload = (Omit<MemberTestimonial, 'id' | 'isVerified'> & { proofFileUrl?: string; proofLink?: string })[];
export type AwardsEditPayload = (Omit<MemberAward, 'id'> & { proofFileUrl?: string; proofLink?: string })[];
export type KeyClientsEditPayload = (Omit<MemberKeyClient, 'id'> & { logoUploadPath?: string })[];

// education / work_experiences: one shared proof for the whole batch — carried on the edit row's
// own proofFileUrl/proofLink, not per item.
export type EducationEditPayload = Omit<MemberEducation, 'id'>[];
export type WorkExperiencesEditPayload = Omit<MemberWorkExperience, 'id'>[];

export type MemberEditPayload =
  | { section: 'headline_bio'; payload: HeadlineBioEditPayload }
  | { section: 'contact'; payload: ContactEditPayload }
  | { section: 'engagements'; payload: EngagementsEditPayload }
  | { section: 'education'; payload: EducationEditPayload }
  | { section: 'work_experiences'; payload: WorkExperiencesEditPayload }
  | { section: 'key_clients'; payload: KeyClientsEditPayload }
  | { section: 'testimonials'; payload: TestimonialsEditPayload }
  | { section: 'awards'; payload: AwardsEditPayload };

export type CreateMemberEditRequest = MemberEditPayload & {
  proofFileUrl?: string;
  proofLink?: string;
};

export class MemberProfileEditDto {
  @ApiProperty() id!: string;
  @ApiProperty() memberId!: string;
  @ApiProperty() memberName!: string;
  @ApiProperty({
    enum: [
      'headline_bio',
      'contact',
      'engagements',
      'education',
      'work_experiences',
      'key_clients',
      'testimonials',
      'awards',
    ],
  })
  section!: MemberEditSection;
  // Shape depends on `section` (see MemberEditPayload above) — left untyped for Swagger/OpenAPI,
  // same as the eslint exemption below for the same reason.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @ApiProperty({ type: 'object', additionalProperties: true }) payload: any;
  @ApiProperty({ nullable: true, type: String }) proofFileUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) proofLink!: string | null;
  @ApiProperty({ enum: ['pending', 'verified', 'rejected'] }) status!: MemberEditStatus;
  @ApiProperty({ nullable: true, type: String }) reviewNote!: string | null;
  @ApiProperty({ nullable: true, type: String }) reviewedBy!: string | null;
  @ApiProperty({ nullable: true, type: String }) reviewedAt!: string | null;
  @ApiProperty() submittedAt!: string;
}

export class ReviewMemberEditRequest {
  @ApiProperty({ enum: ['verified', 'rejected'] }) status!: 'verified' | 'rejected';
  @ApiPropertyOptional() reviewNote?: string;
}

export class RenewalPolicyDto {
  @ApiProperty() periodMonths!: number;
  @ApiProperty() reminderDays!: number;
  @ApiProperty() updatedAt!: string;
}

export class UpdateRenewalPolicyRequest {
  @ApiPropertyOptional() periodMonths?: number;
  @ApiPropertyOptional() reminderDays?: number;
}
