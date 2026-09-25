import { IsDefined, IsIn, IsOptional, IsString } from 'class-validator';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload!: any;

  // Storage object path from POST /v1/members/:id/uploads, not a fully-qualified URL.
  @IsOptional()
  @IsString()
  proofFileUrl?: string;

  @IsOptional()
  @IsString()
  proofLink?: string;
}
