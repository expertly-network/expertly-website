import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { AiGenerationStatus } from '@shared/article';

const AI_GENERATION_STATUSES: AiGenerationStatus[] = ['success', 'failed'];

// GET /v1/admin/ai-generations query params — both optional filters.
export class AdminAiGenerationsQueryDto {
  @IsOptional()
  @IsIn(AI_GENERATION_STATUSES)
  status?: AiGenerationStatus;

  @IsOptional()
  @IsUUID()
  authorId?: string;
}
