import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import type { MembershipTier } from '@shared/membership-application';
import { ProfileOverridesDto } from './profile-overrides.dto';

const MEMBER_TIERS: MembershipTier[] = ['budding_entrepreneur', 'seasoned_professional'];

export class ReviewApplicationDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  // Required when status is 'rejected'.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;

  // Required when status is 'approved'. Any active, non-custom service in the taxonomy, or one of
  // the applicant's own submitted preferences (which may be a custom service they created).
  // Exactly this one service is provisioned; other preferences are not auto-approved.
  @IsOptional()
  @IsUUID()
  approvedServiceId?: string;

  // Optional, approve-only: admin corrections applied to the new member profile. The application
  // itself is never modified. Rejected with OVERRIDES_ON_REJECT on a rejection.
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileOverridesDto)
  profileOverrides?: ProfileOverridesDto;

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
