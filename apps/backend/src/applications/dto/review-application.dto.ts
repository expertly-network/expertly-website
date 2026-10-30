import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { MembershipTier } from '@shared/membership-application';

const MEMBER_TIERS: MembershipTier[] = ['budding_entrepreneur', 'seasoned_professional'];

export class ReviewApplicationDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  // Required when status is 'rejected'.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;

  // Required when status is 'approved' — must be one of the applicant's own submitted
  // service_preferences. Approving no longer auto-provisions every submitted preference.
  @IsOptional()
  @IsUUID()
  approvedServiceId?: string;

  // Optional admin override, only used when status is 'approved'. Falls back to the applicant's
  // own computed selectedTier when omitted — see ApplicationsService.reviewApplication().
  @IsOptional()
  @IsIn(MEMBER_TIERS)
  memberTier?: MembershipTier;

  // Optional, only used when status is 'approved'. Defaults to "now" when omitted.
  @IsOptional()
  @IsDateString()
  membershipStartedAt?: string;
}
