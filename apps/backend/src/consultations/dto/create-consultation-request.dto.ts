import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateConsultationRequestDto {
  @IsUUID()
  memberId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  // 100-character floor is a quality bar for the member deciding whether to accept, not just
  // validation — enforced here since it's a simple length check; the "serviceId XOR
  // customServiceLabel, at least one required" cross-field rule can't be expressed with
  // class-validator alone and lives in ConsultationsService.create() instead.
  @IsString()
  @IsNotEmpty()
  @MinLength(100)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  customServiceLabel?: string;
}
