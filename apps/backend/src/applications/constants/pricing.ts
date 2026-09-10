import type { BillingPeriod, MembershipTier } from '@shared/membership-application';

// Membership price by billing period. Price does not vary by tier.
export const MEMBERSHIP_PRICE_CENTS: Record<BillingPeriod, number> = {
  annual: 49900,
};

// Returns the membership tier for a given years of experience.
export function computeTier(yearsOfExperience: number): MembershipTier {
  return yearsOfExperience > 12 ? 'seasoned_professional' : 'budding_entrepreneur';
}
