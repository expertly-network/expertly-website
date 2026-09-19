import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ServiceDto {
  @ApiProperty() id!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isCustom!: boolean;
  @ApiProperty() isActive!: boolean;
}

export class CreateServiceRequest {
  @ApiProperty() name!: string;
  @ApiPropertyOptional() isCustom?: boolean;
}

export type UpdateServiceRequest = Partial<CreateServiceRequest & { sortOrder: number; isActive: boolean }>;
