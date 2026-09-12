import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
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

// Payload shape depends on section; validated in MembersService.createEdit().
export class CreateMemberEditDto {
  @IsIn(SECTIONS)
  section!: MemberEditSection;

  @IsObject()
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
