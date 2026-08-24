import { IsIn } from 'class-validator';

export class UploadApplicationFileDto {
  @IsIn(['photo', 'document'])
  kind!: 'photo' | 'document';
}
