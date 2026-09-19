import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ServicePreferenceDto {
  @IsUUID()
  serviceId!: string;

  @IsIn([1, 2, 3])
  priority!: 1 | 2 | 3;

  @IsOptional()
  @IsString()
  customLabel?: string;
}
