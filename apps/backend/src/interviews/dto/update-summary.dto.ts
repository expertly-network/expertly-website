// dto/update-summary.dto.ts
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';
import type { UpdateInterviewSummaryRequest } from '@shared/interview';

export class UpdateSummaryDto implements UpdateInterviewSummaryRequest {
  @IsString()
  @MinLength(20)
  @MaxLength(1500)
  summary!: string;

  @IsBoolean()
  approve!: boolean;
}
