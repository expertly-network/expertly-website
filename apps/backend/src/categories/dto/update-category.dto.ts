import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
