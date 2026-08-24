import { IsUrl } from 'class-validator';

export class LinkedInImportRequestDto {
  @IsUrl()
  linkedinUrl!: string;
}
