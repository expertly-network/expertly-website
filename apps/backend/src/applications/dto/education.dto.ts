import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LABEL_MAX, YEAR_MAX, YEAR_MIN } from './field-limits';

// institution/degree may be blank in a draft; both are required at submit — see
// application-completeness.ts.
export class EducationDto {
  @IsString()
  @MaxLength(LABEL_MAX)
  institution!: string;

  @IsString()
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
