import { IsDefined, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { MemberEditSection } from '@shared/member';

const SECTIONS: MemberEditSection[] = [
  'headline_bio',
  'contact',
  'engagements',
  'education',
  'work_experiences',
  'key_clients',
  'testimonials',
  'awards',
];

// Payload shape depends on section — object for headline_bio/contact, array for every other
// section (see SECTION_TO_COLUMN sections) — so it's validated in
// MembersService.validateEditPayloadShape() rather than here. @IsDefined() only keeps the
// property from being stripped by the global ValidationPipe's `whitelist: true`.
export class CreateMemberEditDto {
  @IsIn(SECTIONS)
  section!: MemberEditSection;

  @IsDefined()
  payload!: unknown;

  // Storage object path from POST /v1/members/:id/uploads, not a fully-qualified URL.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  proofFileUrl?: string;

  // Rendered as a link on the admin review screen — http(s) only (no javascript:/data: URLs);
  // checked with the same rule as every other member link (members/member-sections.ts).
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  proofLink?: string;
}
