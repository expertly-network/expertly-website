import { IsBoolean } from 'class-validator';

export class UpdateRecommendationDto {
  @IsBoolean()
  isHidden!: boolean;
}
