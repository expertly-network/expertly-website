import { IsIn, IsOptional, IsString } from 'class-validator';

export class AdminArticleReviewDto {
  @IsIn(['published', 'rejected'])
  status!: 'published' | 'rejected';

  // Required when status is 'rejected'.
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
