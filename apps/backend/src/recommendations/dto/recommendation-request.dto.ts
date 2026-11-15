import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRecommendationRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class UpdateRecommendationRequestDto {
  @IsIn(['ignore', 'cancel'])
  action!: 'ignore' | 'cancel';
}

export class ListRecommendationRequestsQueryDto {
  @IsOptional()
  @IsIn(['sent', 'received'])
  direction?: 'sent' | 'received';
}
