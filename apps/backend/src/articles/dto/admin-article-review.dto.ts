import { IsIn, IsOptional, IsString } from 'class-validator';

export class AdminArticleReviewDto {
  @IsIn(['published', 'rejected'])
  status!: 'published' | 'rejected';

  // Required when status is 'rejected' — checked in ArticlesService.review(), not here, same
  // convention as ReviewApplicationDto.rejectionReason.
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
