import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EMAIL_MAX, NAME_MAX, PHONE_MAX } from './field-limits';

export class PeerReferenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  relationship!: string;

  @IsEmail()
  @MaxLength(EMAIL_MAX)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PHONE_MAX)
  phone?: string;
}
