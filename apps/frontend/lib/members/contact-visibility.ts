import type { MemberDto } from '@shared/member';

// The API withholds a member's direct contact details (contactEmail, workEmail, contactPhone,
// linkedinUrl — returned as null) from viewers who aren't the owner, an admin, an active member, or
// a client with a consultation request to this member, and says so with `contactVisible: false`.
// Shared by the profile's Contact tab and the profile PDF so both explain the gap the same way.

export const CONTACT_HIDDEN_MESSAGE =
  'Contact details are shared with members and with clients who have a consultation with this member.';

/** False when the API withheld the direct contact fields from this viewer. */
export function isContactVisible(member: MemberDto): boolean {
  return member.contactVisible;
}
