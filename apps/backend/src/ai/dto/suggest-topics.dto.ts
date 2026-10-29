import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class SuggestTopicsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  serviceIds?: string[];
}
