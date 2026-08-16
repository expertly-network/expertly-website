import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;
}
