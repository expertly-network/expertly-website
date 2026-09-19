import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}
