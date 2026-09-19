import { IsArray, IsOptional, IsString } from 'class-validator';

export class SuggestTopicsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];
}
