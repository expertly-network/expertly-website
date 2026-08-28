import type { BillingPeriod, MembershipTier } from '@shared/membership-application';

export const MEMBERSHIP_PRICE_CENTS: Record<BillingPeriod, number> = {
  monthly: 4900,
  annual: 49900,
};


export function computeTier(yearsOfExperience: number): MembershipTier {
  return yearsOfExperience > 12 ? 'seasoned_professional' : 'budding_entrepreneur';
}
