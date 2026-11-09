// dto/admin-list-query.dto.ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { InterviewStatus } from '@shared/interview';

const STATUSES: InterviewStatus[] = [
  'ready',
  'in_progress',
  'interrupted',
  'processing',
  'completed',
  'failed',
  'voided',
];

export class AdminListQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: InterviewStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
