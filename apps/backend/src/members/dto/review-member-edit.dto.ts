import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewMemberEditDto {
  @IsIn(['verified', 'rejected'])
  status!: 'verified' | 'rejected';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
