import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ServicePreferenceDto {
  @IsUUID()
  serviceId!: string;

  @IsIn([1, 2, 3])
  priority!: 1 | 2 | 3;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customLabel?: string;
}
