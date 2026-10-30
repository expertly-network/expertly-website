import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { BillingPeriod } from '@shared/membership-application';

const BILLING_PERIODS: BillingPeriod[] = ['annual'];

export class CouponPreviewDto {
  @IsIn(BILLING_PERIODS)
  billingPeriod!: BillingPeriod;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  couponCode?: string;
}
