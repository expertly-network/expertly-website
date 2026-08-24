import { IsIn, IsObject, IsOptional, IsString, IsUrl } from 'class-validator';
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

// `payload`'s per-section shape is a discriminated union in packages/shared-types/member.ts —
// class-validator can't express "validate differently depending on the value of another field"
// cleanly for one call site, so the DTO only checks the envelope; MembersService.createEdit()
// validates payload's shape against `section` before insert.
export class CreateMemberEditDto {
  @IsIn(SECTIONS)
  section!: MemberEditSection;

  @IsObject()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload!: any;

  @IsOptional()
  @IsUrl()
  proofFileUrl?: string;

  @IsOptional()
  @IsString()
  proofLink?: string;
}
