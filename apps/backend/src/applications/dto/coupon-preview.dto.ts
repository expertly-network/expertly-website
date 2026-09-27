import { IsIn, IsOptional, IsString } from 'class-validator';
import type { BillingPeriod } from '@shared/membership-application';

const BILLING_PERIODS: BillingPeriod[] = ['annual'];

export class CouponPreviewDto {
  @IsIn(BILLING_PERIODS)
  billingPeriod!: BillingPeriod;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
