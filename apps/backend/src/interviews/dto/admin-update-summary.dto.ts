// dto/admin-update-summary.dto.ts
import { IsBoolean } from 'class-validator';
import type { AdminUpdateInterviewSummaryRequest } from '@shared/interview';

export class AdminUpdateSummaryDto implements AdminUpdateInterviewSummaryRequest {
  @IsBoolean()
  hidden!: boolean;
}
