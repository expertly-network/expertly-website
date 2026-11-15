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

export class MemberService {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() categoryName!: string;
}

export class MemberWorkExperience {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() company!: string;
  /** 1-12, optional. */
  @ApiProperty({ nullable: true, type: Number }) startMonth!: number | null;
  @ApiProperty() startYear!: number;
  @ApiProperty({ nullable: true, type: Number }) endMonth!: number | null;
  @ApiProperty({ nullable: true, type: Number }) endYear!: number | null;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  /** Set by the admin's per-item review ('approved_verified'); drives the Verified badge. */
  @ApiProperty() isVerified!: boolean;
  /** Owner/admin only (omitted for other viewers). Optional proof for this entry. */
  @ApiPropertyOptional({ type: () => ProofAttachment, isArray: true }) proofAttachments?: ProofAttachment[];
  /** Owner and admins only (server-owned): when the entry was last changed, and last verified. */
  @ApiPropertyOptional() changedAt?: string | null;
  @ApiPropertyOptional() verifiedAt?: string | null;
}

export class MemberEducation {
  @ApiProperty() id!: string;
  @ApiProperty() degree!: string;
  @ApiProperty() institution!: string;
  @ApiProperty({ nullable: true, type: String }) field!: string | null;
  @ApiProperty({ nullable: true, type: Number }) endYear!: number | null;
  @ApiProperty() isVerified!: boolean;
  /** Owner/admin only (omitted for other viewers). Optional proof for this entry. */
  @ApiPropertyOptional({ type: () => ProofAttachment, isArray: true }) proofAttachments?: ProofAttachment[];
  /** Owner and admins only (server-owned): when the entry was last changed, and last verified. */
  @ApiPropertyOptional() changedAt?: string | null;
  @ApiPropertyOptional() verifiedAt?: string | null;
}

const ENGAGEMENT_VERIFICATION_METHODS = [
  'engagement_letter',
  'client_deliverable',
  'mail_confirmation_pdf',
  'newsletter_transaction_update',
  'other',
] as const;
export type EngagementVerificationMethod = (typeof ENGAGEMENT_VERIFICATION_METHODS)[number];

export class MemberEngagement {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  /** Legacy: no longer collected (2026-11-15); only older items carry it. */
  @ApiPropertyOptional({ nullable: true, type: String }) organization?: string | null;
  /** Required unless `isConfidential`. For a confidential client, every viewer except the owner and admins gets "Confidential client" here. */
  @ApiProperty({ nullable: true, type: String }) clientName!: string | null;
  /** The client's name is hidden from everyone except the owner and admins. */
  @ApiProperty() isConfidential!: boolean;
  @ApiProperty({ enum: ENGAGEMENT_VERIFICATION_METHODS, isArray: true })
  verificationMethods!: EngagementVerificationMethod[];
  /** Free-text description of the method; only meaningful when verificationMethods includes 'other'. */
  @ApiProperty({ nullable: true, type: String }) verificationMethodOther!: string | null;
  @ApiProperty({ nullable: true, type: Number }) year!: number | null;
  @ApiProperty({ nullable: true, type: String }) url!: string | null;
  @ApiProperty() isVerified!: boolean;
  /** Present only for the owning member and admins (private proof); omitted for other viewers. */
  @ApiPropertyOptional({ type: () => ProofAttachment, isArray: true }) proofAttachments?: ProofAttachment[];
  /** Owner and admins only (server-owned): when the entry was last changed, and last verified. */
  @ApiPropertyOptional() changedAt?: string | null;
  @ApiPropertyOptional() verifiedAt?: string | null;
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
  /** Legacy: no longer collected (2026-11-15). */
  @ApiPropertyOptional({ nullable: true, type: String }) serviceName?: string | null;
  /** Legacy: no longer collected (2026-11-15). */
  @ApiPropertyOptional({ nullable: true, type: String }) occurredOn?: string | null;
  @ApiProperty() isVerified!: boolean;
  /** Owner/admin only. */
  @ApiPropertyOptional({ type: () => ProofAttachment, isArray: true }) proofAttachments?: ProofAttachment[];
  /** Owner and admins only (server-owned): when the entry was last changed, and last verified. */
  @ApiPropertyOptional() changedAt?: string | null;
  @ApiPropertyOptional() verifiedAt?: string | null;
}

export class MemberAward {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true, type: String }) issuingBody!: string | null;
  @ApiProperty({ nullable: true, type: Number }) year!: number | null;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty() isVerified!: boolean;
  /** Owner/admin only. */
  @ApiPropertyOptional({ type: () => ProofAttachment, isArray: true }) proofAttachments?: ProofAttachment[];
  /** Owner and admins only (server-owned): when the entry was last changed, and last verified. */
  @ApiPropertyOptional() changedAt?: string | null;
  @ApiPropertyOptional() verifiedAt?: string | null;
}

/** Max key clients per member (20), enforced on submission by the backend. */
export class MemberKeyClient {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) logoUrl!: string | null;
  /** Verified row vs unverified row on the profile. */
  @ApiProperty() isVerified!: boolean;
  /** Owner/admin only. */
  @ApiPropertyOptional({ type: () => ProofAttachment, isArray: true }) proofAttachments?: ProofAttachment[];
  /** Owner and admins only (server-owned): when the entry was last changed, and last verified. */
  @ApiPropertyOptional() changedAt?: string | null;
  @ApiPropertyOptional() verifiedAt?: string | null;
}

// GET /v1/members list-view shape. No child arrays, no self-edit state.
export class MemberListItemDto {
  /** Membership start date; used for the dashboard new-member feed. */
  @ApiPropertyOptional() joinedAt?: string;
  @ApiProperty() id!: string;
  /** Server-generated at provisioning time, kebab-case, never regenerated afterward. */
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() initials!: string;
  @ApiProperty({ nullable: true, type: String }) headline!: string | null;
  @ApiProperty({ nullable: true, type: String }) bio!: string | null;
  @ApiProperty({ nullable: true, type: String }) firmName!: string | null;
  @ApiProperty({ nullable: true, enum: APPLICATION_REGIONS }) region!: ApplicationRegion | null;
  @ApiProperty() country!: string;
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
  @ApiProperty({ type: () => MemberService, isArray: true }) services!: MemberService[];
  @ApiProperty() isVerified!: boolean;
  @ApiProperty({ enum: ['budding_entrepreneur', 'seasoned_professional'] }) memberTier!: MembershipTier;
  @ApiProperty() yearsOfExperience!: number;
  @ApiProperty({ nullable: true, type: Number }) rateMinCents!: number | null;
  @ApiProperty({ nullable: true, type: Number }) rateMaxCents!: number | null;
  @ApiProperty() rateCurrency!: string;
  @ApiProperty({ nullable: true, type: String }) photoUrl!: string | null;
}

// GET /v1/members/:id full detail. A member's own articles are fetched separately.
export class MemberDto extends MemberListItemDto {
  @ApiProperty({ nullable: true, type: String }) availabilityNotes!: string | null;
  @ApiProperty() isAvailable!: boolean;
  @ApiProperty({ nullable: true, type: String }) contactEmail!: string | null;
  /** Optional professional address, separate from contactEmail. Show on the contact tab only when set. */
  @ApiProperty({ nullable: true, type: String }) workEmail!: string | null;
  @ApiProperty({ nullable: true, type: String }) contactPhone!: string | null;
  @ApiProperty({ nullable: true, type: String }) linkedinUrl!: string | null;
  /** False when contactEmail/workEmail/contactPhone/linkedinUrl were withheld (null) for this viewer. */
  @ApiProperty() contactVisible!: boolean;
  @ApiProperty({ nullable: true, type: String }) website!: string | null;
  @ApiProperty({ type: () => MemberWorkExperience, isArray: true }) workExperiences!: MemberWorkExperience[];
  @ApiProperty({ type: () => MemberEducation, isArray: true }) educations!: MemberEducation[];
  @ApiProperty({ type: () => MemberEngagement, isArray: true }) engagements!: MemberEngagement[];
  @ApiProperty({ type: () => MemberQualification, isArray: true }) qualifications!: MemberQualification[];
  @ApiProperty({ type: () => MemberCredential, isArray: true }) credentials!: MemberCredential[];
  @ApiProperty({ type: () => MemberTestimonial, isArray: true }) testimonials!: MemberTestimonial[];
  @ApiProperty({ type: () => MemberAward, isArray: true }) awards!: MemberAward[];
  @ApiProperty({ type: () => MemberKeyClient, isArray: true }) keyClients!: MemberKeyClient[];
  /** An admin has verified the contact block (shown as a tick; otherwise "Pending Verification"). */
  @ApiProperty() contactVerified!: boolean;
}

// Admin-only fields layered on top of the list shape — GET /v1/admin/members.
export class AdminMemberListItemDto extends MemberListItemDto {
  @ApiProperty({ enum: ['active', 'deactivated'] }) status!: MemberProfileStatus;
  @ApiProperty({ nullable: true, type: String }) applicationId!: string | null;
  @ApiProperty() membershipStartedAt!: string;
  @ApiProperty({ nullable: true, enum: ['paid', 'pending', 'overdue'] })
  renewalPaymentStatus!: RenewalPaymentStatus | null;
  @ApiProperty({ enum: ['active', 'due-soon', 'overdue'] }) renewalDueState!: RenewalDueState;
}

export class UpdateAdminMemberRequest {
  @ApiPropertyOptional({ enum: ['active', 'deactivated'] }) status?: MemberProfileStatus;
  @ApiPropertyOptional() membershipStartedAt?: string;
  @ApiPropertyOptional({ nullable: true, enum: ['paid', 'pending', 'overdue'] })
  renewalPaymentStatus?: RenewalPaymentStatus | null;
}

/** Every type POST /v1/members/:id/uploads accepts (mirrors the member-proofs bucket). */
export type MemberUploadContentType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export class UploadRequest {
  @ApiProperty({ maxLength: 200 }) fileName!: string;
  /** Declared type of the file about to be uploaded; one of MemberUploadContentType. */
  @ApiProperty({ enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'] })
  contentType!: MemberUploadContentType;
}

export class UploadResponse {
  @ApiProperty() uploadUrl!: string;
  @ApiProperty() path!: string;
}

/**
 * PATCH /v1/members/:id — the owner's directly-editable fields, any combination (at least one).
 * Applied immediately, no admin review. Returns the updated MemberDto. Vetted profile content goes
 * through POST /v1/members/:id/edits instead.
 */
export class UpdateMemberRequest {
  /** The "available for consultations" switch. */
  @ApiPropertyOptional() isAvailable?: boolean;
  /** Short note shown under the status, e.g. "Back from 4 Nov". Omit to keep, null/'' to clear. Max 200. */
  @ApiPropertyOptional({ nullable: true, type: String }) availabilityNotes?: string | null;
  /** New profile photo: the `path` returned by POST /v1/members/:id/uploads (JPEG/PNG/WebP, ≤5MB). */
  @ApiPropertyOptional() photoUploadPath?: string;
}

// Self-editable profile sections. `payload`'s shape depends on `section` — a discriminated union
// rather than a loose `unknown`.
export type MemberEditSection =
  | 'headline_bio'
  | 'contact'
  | 'engagements'
  | 'education'
  | 'work_experiences'
  | 'key_clients'
  | 'testimonials'
  | 'awards';

export class HeadlineBioEditPayload {
  @ApiProperty() headline!: string;
  @ApiProperty() bio!: string;
}

export class ContactEditPayload {
  @ApiProperty({ nullable: true, type: String }) workEmail!: string | null;
  @ApiProperty({ nullable: true, type: String }) contactPhone!: string | null;
  @ApiProperty({ nullable: true, type: String }) linkedinUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) website!: string | null;
}

// One piece of proof for a single item — `url` is a storage object path (from
// POST /v1/members/:id/uploads) when type is 'file', or the raw URL the member pasted when
// type is 'link'. `label` is what's shown in the attachment list (original filename, or the
// link text itself).
export class ProofAttachment {
  @ApiProperty({ enum: ['file', 'link'] }) type!: 'file' | 'link';
  @ApiProperty() url!: string;
  @ApiProperty() label!: string;
}

// Proof/asset lives per-item for these sections, embedded in each array element — a member can
// attach any mix of multiple files and links to a single item.
//
// Every item may carry `id` — the live item's id when the member is editing an existing item
// (keeps the id stable, and lets a rejected change fall back to the live version). Omit `id` for
// a brand-new item. `isVerified` is server-owned and never accepted from the client. Proof is
// OPTIONAL everywhere; without it an admin can still approve the item, just not as verified.
export type EditItem<T> = Omit<T, 'id' | 'isVerified' | 'proofAttachments' | 'changedAt' | 'verifiedAt'> & {
  id?: string;
  proofAttachments?: ProofAttachment[];
};
export type EngagementsEditPayload = (Omit<
  EditItem<MemberEngagement>,
  'clientName' | 'isConfidential' | 'verificationMethods' | 'verificationMethodOther'
> & {
  clientName?: string | null;
  isConfidential?: boolean;
  verificationMethods?: EngagementVerificationMethod[];
  verificationMethodOther?: string | null;
})[];
export type TestimonialsEditPayload = EditItem<MemberTestimonial>[];
export type AwardsEditPayload = EditItem<MemberAward>[];
/** At most 20 items. */
export type KeyClientsEditPayload = (EditItem<MemberKeyClient> & { logoUploadPath?: string })[];

// Proof is per item on every list section (2026-11-15). Work history may overlap (concurrent roles)
// and is stored newest-first.
export type EducationEditPayload = EditItem<MemberEducation>[];
export type WorkExperiencesEditPayload = (Omit<EditItem<MemberWorkExperience>, 'startMonth' | 'endMonth'> & {
  startMonth?: number | null;
  endMonth?: number | null;
})[];

export type MemberEditPayload =
  | { section: 'headline_bio'; payload: HeadlineBioEditPayload }
  | { section: 'contact'; payload: ContactEditPayload }
  | { section: 'engagements'; payload: EngagementsEditPayload }
  | { section: 'education'; payload: EducationEditPayload }
  | { section: 'work_experiences'; payload: WorkExperiencesEditPayload }
  | { section: 'key_clients'; payload: KeyClientsEditPayload }
  | { section: 'testimonials'; payload: TestimonialsEditPayload }
  | { section: 'awards'; payload: AwardsEditPayload };

// ---- Member recommendations (Reviews & Recognition tab) ----

export class MemberRecommendationAuthor {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() initials!: string;
  @ApiProperty({ nullable: true, type: String }) photoUrl!: string | null;
}

export class MemberRecommendationDto {
  @ApiProperty() id!: string;
  /** The recommended member's profile id. */
  @ApiProperty() recipientId!: string;
  @ApiProperty({ type: () => MemberRecommendationAuthor }) author!: MemberRecommendationAuthor;
  @ApiProperty() body!: string;
  /** Hidden by the recipient. Hidden ones are only returned to the recipient (and admins). */
  @ApiProperty() isHidden!: boolean;
  @ApiProperty() createdAt!: string;
}

export class CreateRecommendationRequest {
  /** 10-2000 characters, plain text. */
  @ApiProperty() body!: string;
}

export class UpdateRecommendationRequest {
  @ApiProperty() isHidden!: boolean;
}

/** The live value of every self-editable section (admin verification view). */
export class MemberEditCurrentValues {
  @ApiProperty({ type: () => HeadlineBioEditPayload }) headline_bio!: { headline: string | null; bio: string | null };
  @ApiProperty({ type: () => ContactEditPayload }) contact!: ContactEditPayload;
  @ApiProperty({ type: () => MemberEngagement, isArray: true }) engagements!: MemberEngagement[];
  @ApiProperty({ type: () => MemberEducation, isArray: true }) education!: MemberEducation[];
  @ApiProperty({ type: () => MemberWorkExperience, isArray: true }) work_experiences!: MemberWorkExperience[];
  @ApiProperty({ type: () => MemberKeyClient, isArray: true }) key_clients!: MemberKeyClient[];
  @ApiProperty({ type: () => MemberTestimonial, isArray: true }) testimonials!: MemberTestimonial[];
  @ApiProperty({ type: () => MemberAward, isArray: true }) awards!: MemberAward[];
}

export class AdminEditMemberSummary {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() initials!: string;
  @ApiProperty({ nullable: true, type: String }) email!: string | null;
  @ApiProperty({ nullable: true, type: String }) photoUrl!: string | null;
  @ApiProperty({ enum: ['active', 'deactivated'] }) status!: MemberProfileStatus;
  @ApiProperty() isVerified!: boolean;
}

/** GET /v1/admin/members/:id/verification — what the admin needs to verify one member's profile. */
export class AdminMemberVerificationDetailDto {
  @ApiProperty({ type: () => AdminEditMemberSummary }) member!: AdminEditMemberSummary;
  /** The live value of every section, proof included. */
  @ApiProperty({ type: () => MemberEditCurrentValues }) current!: MemberEditCurrentValues;
  @ApiProperty() contactVerified!: boolean;
  /** Storage path -> short-lived signed URL for every private proof file on the live items. */
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } }) fileUrls!: Record<string, string>;
}

/** GET /v1/members/me/profile — the signed-in member's own profile handle (e.g. "View my profile"). */
export class MyMemberProfileDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
}
