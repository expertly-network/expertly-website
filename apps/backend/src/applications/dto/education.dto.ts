import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LABEL_MAX, YEAR_MAX, YEAR_MIN } from './field-limits';

export class EducationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(LABEL_MAX)
  institution!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(LABEL_MAX)
  degree!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LABEL_MAX)
  fieldOfStudy?: string;

  @IsOptional()
  @IsInt()
  @Min(YEAR_MIN)
  @Max(YEAR_MAX)
  startYear?: number;

  @IsOptional()
  @IsInt()
  @Min(YEAR_MIN)
  @Max(YEAR_MAX)
  endYear?: number;
}
