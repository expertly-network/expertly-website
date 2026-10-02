import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateConsultationStatusDto {
  @IsIn(['completed', 'declined'])
  status!: 'completed' | 'declined';

  // Required on every status transition — the requester sees this, so a bare status flip with no
  // explanation isn't enough context for them to know why.
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  responseMessage!: string;
}
