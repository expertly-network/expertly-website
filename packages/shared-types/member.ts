import type { ApplicationRegion, MembershipTier } from './membership-application';

export type MemberProfileStatus = 'active' | 'deactivated';
export type RenewalPaymentStatus = 'paid' | 'pending' | 'overdue';
export type RenewalDueState = 'active' | 'due-soon' | 'overdue';

export interface MemberPracticeArea {
  id: string;
  name: string;
}

export interface MemberWorkExperience {
  id: string;
  title: string;
  company: string;
  startYear: number;
  endYear: number | null;
  isCurrent: boolean;
  description: string | null;
}

export interface MemberEducation {
  id: string;
  degree: string;
  institution: string;
  field: string | null;
  endYear: number | null;
}

export interface MemberEngagement {
  id: string;
  title: string;
  organization: string;
  year: number | null;
  url: string | null;
}

export interface MemberQualification {
  id: string;
  name: string;
  year: number | null;
}

export interface MemberCredential {
  id: string;
  name: string;
  issuingBody: string | null;
  year: number | null;
  isVerified: boolean;
}

export interface MemberTestimonial {
  id: string;
  quote: string;
  clientName: string;
  clientTitle: string | null;
  clientCompany: string | null;
  serviceName: string | null;
  occurredOn: string | null;
  isVerified: boolean;
}

export interface MemberAward {
  id: string;
  title: string;
  issuingBody: string | null;
  year: number | null;
  description: string | null;
}

export interface MemberKeyClient {
  id: string;
  name: string;
  logoUrl: string | null;
}

// List-view shape — GET /v1/members. No child arrays, no self-edit state. `bio` IS included
// (unlike the child arrays) — the directory card shows a 2-line excerpt of it
// (`line-clamp-2`), matching design/static_html/members.html's card exactly; truncation is
// client-side, same as the design's own `-webkit-line-clamp` approach.
export interface MemberListItemDto {
  id: string;
  name: string;
  initials: string;
  headline: string | null;
  bio: string | null;
  firmName: string | null;
  region: ApplicationRegion | null;
  country: string;
  city: string | null;
  practiceAreas: MemberPracticeArea[];
  isVerified: boolean;
  memberTier: MembershipTier;
  yearsOfExperience: number;
  rateMinCents: number | null;
  rateMaxCents: number | null;
  rateCurrency: string;
  photoUrl: string | null;
}

// Full detail — GET /v1/members/:id. A member's own published articles are fetched separately via
// GET /v1/articles?authorId=, not embedded here.
export interface MemberDto extends MemberListItemDto {
  firmWebsite: string | null;
  availabilityNotes: string | null;
  isAvailable: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedinUrl: string | null;
  website: string | null;
  workExperiences: MemberWorkExperience[];
  educations: MemberEducation[];
  engagements: MemberEngagement[];
  qualifications: MemberQualification[];
  credentials: MemberCredential[];
  testimonials: MemberTestimonial[];
  awards: MemberAward[];
  keyClients: MemberKeyClient[];
}

// Admin-only fields layered on top of the list shape — GET /v1/admin/members.
export interface AdminMemberListItemDto extends MemberListItemDto {
  status: MemberProfileStatus;
  applicationId: string | null;
  membershipStartedAt: string;
  renewalPaymentStatus: RenewalPaymentStatus | null;
  renewalDueState: RenewalDueState;
}

export interface UpdateAdminMemberRequest {
  status?: MemberProfileStatus;
  membershipStartedAt?: string;
  renewalPaymentStatus?: RenewalPaymentStatus | null;
}

export interface UploadRequest {
  fileName: string;
  contentType: string;
}

export interface UploadResponse {
  uploadUrl: string;
  path: string;
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

export interface HeadlineBioEditPayload {
  headline: string;
  bio: string;
}

export interface ContactEditPayload {
  contactEmail: string | null;
  contactPhone: string | null;
  linkedinUrl: string | null;
  website: string | null;
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

export interface MemberProfileEditDto {
  id: string;
  memberId: string;
  memberName: string;
  section: MemberEditSection;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  proofFileUrl: string | null;
  proofLink: string | null;
  status: MemberEditStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedAt: string;
}

export interface ReviewMemberEditRequest {
  status: 'verified' | 'rejected';
  reviewNote?: string;
}

export interface RenewalPolicyDto {
  periodMonths: number;
  reminderDays: number;
  updatedAt: string;
}

export interface UpdateRenewalPolicyRequest {
  periodMonths?: number;
  reminderDays?: number;
}
