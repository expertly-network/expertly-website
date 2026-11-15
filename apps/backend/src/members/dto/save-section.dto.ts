import { IsDefined } from 'class-validator';
import type { MemberEditSection } from '@shared/member';

export const MEMBER_EDIT_SECTIONS: readonly MemberEditSection[] = [
  'headline_bio',
  'contact',
  'engagements',
  'education',
  'work_experiences',
  'key_clients',
  'testimonials',
  'awards',
];

/** For `ParseEnumPipe`: a record whose values are the allowed `:section` path values. */
export const MEMBER_EDIT_SECTION_ENUM = Object.fromEntries(MEMBER_EDIT_SECTIONS.map((s) => [s, s])) as Record<
  MemberEditSection,
  MemberEditSection
>;

// PUT /v1/members/:id/sections/:section — the whole new section. Its shape depends on the section,
// so class-validator can't express it; MembersService validates it (validateAndPrepareEditPayload).
// @IsDefined() only keeps the property from being stripped by the global whitelist.
export class SaveMemberSectionDto {
  @IsDefined()
  payload!: unknown;
}
