// dto/start-interview.dto.ts
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { StartInterviewRequest } from '@shared/interview';

export class StartInterviewDto implements StartInterviewRequest {
  @IsString()
  @MaxLength(40)
  consentVersion!: string;

  @IsOptional()
  @IsBoolean()
  audioOptIn?: boolean;
}
