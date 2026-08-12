import { IsIn, IsUUID } from 'class-validator';

export class ServicePreferenceDto {
  @IsUUID()
  practiceAreaId!: string;

  @IsIn([1, 2, 3])
  priority!: 1 | 2 | 3;
}
