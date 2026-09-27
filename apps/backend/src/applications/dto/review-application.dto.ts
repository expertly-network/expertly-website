import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewApplicationDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  // Required when status is 'rejected'.
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  // Required when status is 'approved' — must be one of the applicant's own submitted
  // service_preferences. Approving no longer auto-provisions every submitted preference.
  @IsOptional()
  @IsString()
  approvedServiceId?: string;
}
