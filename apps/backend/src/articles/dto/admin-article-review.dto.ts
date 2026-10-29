import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminArticleReviewDto {
  @IsIn(['published', 'rejected'])
  status!: 'published' | 'rejected';

  // Required when status is 'rejected'.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;

  // Version binding: the decision applies only to the content the reviewer actually saw.
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}
