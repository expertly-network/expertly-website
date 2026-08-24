import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateRenewalPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  periodMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reminderDays?: number;
}
