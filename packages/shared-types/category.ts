import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceDto } from './service';

export class CategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: () => ServiceDto, isArray: true }) services!: ServiceDto[];
}

export class CreateCategoryRequest {
  @ApiProperty() name!: string;
  @ApiPropertyOptional() imageUrl?: string;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest & { sortOrder: number; isActive: boolean }>;
