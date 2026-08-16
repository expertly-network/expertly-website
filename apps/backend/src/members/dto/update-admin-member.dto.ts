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

  // Nullable on purpose — admin can clear an override back to "compute the due-state normally"
  // by sending null, not just switch between the three real values. class-validator's @IsIn
  // rejects null unless included in the allowed set explicitly.
  @IsOptional()
  @IsIn([...RENEWAL_STATUSES, null])
  renewalPaymentStatus?: RenewalPaymentStatus | null;
}
