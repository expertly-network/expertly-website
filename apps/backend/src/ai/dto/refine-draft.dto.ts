import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RefineDraftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  refinementNotes!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tone?: string;
}
