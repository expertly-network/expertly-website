import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceDto } from './service';

// The taxonomy is three levels: service line (Tax, Finance, Legal, …) → category → service.
export class CategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
  @ApiProperty() isActive!: boolean;
  /** The service line (taxonomy level 1) this category belongs to. */
  @ApiProperty() serviceLineId!: string;
  @ApiProperty() serviceLineName!: string;
  @ApiProperty({ type: () => ServiceDto, isArray: true }) services!: ServiceDto[];
}

// GET /v1/service-lines — the full active tree, top level first.
export class ServiceLineDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ type: () => CategoryDto, isArray: true }) categories!: CategoryDto[];
}

export class CreateCategoryRequest {
  @ApiProperty() name!: string;
  @ApiPropertyOptional() imageUrl?: string;
  /** Defaults to the "Other" service line when omitted. */
  @ApiPropertyOptional() serviceLineId?: string;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest & { sortOrder: number; isActive: boolean }>;
