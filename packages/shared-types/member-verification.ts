import type { MemberDto, MemberEditPayload, MemberEditSection } from './member';

// Self-edits go live immediately; evidence-based items then show "Pending Verification" until an
// admin verifies them (docs/rest-api.md "Member profile — live edits & verification"). There is no
// admin-to-member messaging: a pending entry simply invites the member to add proof. headline_bio is
// free text with no verification, so it is not a VerifiableSection.
export type VerifiableSection = Exclude<MemberEditSection, 'headline_bio'>;

// PUT /v1/members/:id/sections/:section — the new payload for the whole section (same shapes as
// the legacy POST /edits payloads, minus the shared top-level proof: proof is per item now).
export type SaveMemberSectionRequest = { payload: MemberEditPayload['payload'] };

export interface SaveMemberSectionResponse {
  /** False when the payload equalled the live section — nothing was written, nothing reset. */
  changed: boolean;
  /** The owner's view of the profile after the save. */
  member: MemberDto;
}

// ── admin ───────────────────────────────────────────────────────────────────────────────────
// PATCH /v1/admin/members/:id/sections/:section/items/:itemId
export interface AdminSetItemVerifiedRequest {
  verified: boolean;
}

// PATCH /v1/admin/members/:id/contact-verification
export interface AdminSetContactVerifiedRequest {
  verified: boolean;
}

/** GET /v1/admin/member-verification — one row per member with anything awaiting a decision. */
export interface AdminMemberVerificationSummaryDto {
  memberId: string;
  name: string;
  slug: string;
  contactVerified: boolean;
  unverifiedItems: { section: VerifiableSection; itemId: string; label: string }[];
  /** Pending entries plus an unverified contact block. */
  needsReview: number;
  /** The whole-profile "GrowXQ Verified" flag. */
  profileVerified: boolean;
  /** Every entry is verified but the whole-profile badge has not been given yet. */
  readyForBadge: boolean;
}
