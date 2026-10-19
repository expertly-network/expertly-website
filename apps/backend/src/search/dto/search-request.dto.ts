import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * One body for both actions: a question (default), or `action: 'feedback'` on an earlier answer.
 * Rules that depend on `action` (query 2-500 characters, logId + rating required for feedback)
 * live in SearchService — class-validator can't express them without a custom decorator for a
 * one-call-site rule.
 */
export class SearchRequestDto {
  @ApiPropertyOptional({ enum: ['search', 'feedback'], default: 'search' })
  @IsOptional()
  @IsIn(['search', 'feedback'])
  action?: 'search' | 'feedback';

  @ApiPropertyOptional({ description: 'The question, 2-500 characters.' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ enum: ['all', 'members', 'articles', 'events'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'members', 'articles', 'events'])
  scope?: 'all' | 'members' | 'articles' | 'events';

  @ApiPropertyOptional({ minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiPropertyOptional({ description: 'feedback: the logId returned by an earlier answer.' })
  @IsOptional()
  @IsUUID()
  logId?: string;

  @ApiPropertyOptional({ enum: [1, -1], description: 'feedback: thumbs up (1) or down (-1).' })
  @IsOptional()
  @IsIn([1, -1])
  rating?: number;

  @ApiPropertyOptional({ description: 'feedback: optional note (truncated to 500 characters).' })
  @IsOptional()
  @IsString()
  note?: string;
}
