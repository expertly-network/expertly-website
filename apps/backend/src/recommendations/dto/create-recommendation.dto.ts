import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRecommendationDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  body!: string;
}
