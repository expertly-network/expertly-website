import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PeerReferenceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  relationship!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
