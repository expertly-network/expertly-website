import { IsBoolean } from 'class-validator';

export const VERIFIABLE_SECTIONS = [
  'contact',
  'engagements',
  'education',
  'work_experiences',
  'key_clients',
  'testimonials',
  'awards',
] as const;

export class AdminSetVerifiedDto {
  @IsBoolean()
  verified!: boolean;
}
