import { IsEmail, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { EMAIL_MAX, NAME_MAX, PHONE_MAX } from './field-limits';

// A draft may hold a half-filled reference (the wizard saves the whole form on every step, Back
// included), so blanks are accepted here; completeness — name, relationship, a valid email — is
// enforced at submit (see application-completeness.ts). A non-blank email must still be valid.
export class PeerReferenceDto {
  @IsString()
  @MaxLength(NAME_MAX)
  name!: string;

  @IsString()
  @MaxLength(NAME_MAX)
  relationship!: string;

  @IsString()
  @ValidateIf((o: PeerReferenceDto) => o.email.trim() !== '')
  @IsEmail()
  @MaxLength(EMAIL_MAX)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PHONE_MAX)
  phone?: string;
}
