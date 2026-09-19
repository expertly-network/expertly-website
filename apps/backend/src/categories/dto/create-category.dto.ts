import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
