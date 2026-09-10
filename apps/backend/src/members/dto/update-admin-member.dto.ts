import { IsDateString, IsIn, IsOptional } from 'class-validator';
import type { MemberProfileStatus, RenewalPaymentStatus } from '@shared/member';

const STATUSES: MemberProfileStatus[] = ['active', 'deactivated'];
const RENEWAL_STATUSES: RenewalPaymentStatus[] = ['paid', 'pending', 'overdue'];

export class UpdateAdminMemberDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: MemberProfileStatus;

  @IsOptional()
  @IsDateString()
  membershipStartedAt?: string;

  // null clears the override back to computed.
  @IsOptional()
  @IsIn([...RENEWAL_STATUSES, null])
  renewalPaymentStatus?: RenewalPaymentStatus | null;
}
