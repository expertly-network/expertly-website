import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EducationDto {
  @IsString()
  @IsNotEmpty()
  institution!: string;

  @IsString()
  @IsNotEmpty()
  degree!: string;

  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @IsOptional()
  @IsInt()
  startYear?: number;

  @IsOptional()
  @IsInt()
  endYear?: number;
}
