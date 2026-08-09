import type { BillingPeriod, MembershipTier } from '@shared/membership-application';

// Flat pricing — from design/static_html/membership.html ("$499/year or
// $49/month", "All Professionals", no tier-based pricing shown anywhere in
// the current design). Confirmed explicitly: price does NOT vary by tier —
// tier is computed and stored for other purposes, not pricing.
export const MEMBERSHIP_PRICE_CENTS: Record<BillingPeriod, number> = {
  monthly: 4900,
  annual: 49900,
};

// >12 years -> seasoned_professional, else budding_entrepreneur. Confirmed
// product rule; the operations team can override the final tier at approval
// time (a later feature) — this is only the auto-computed starting value
// stamped onto the immutable application record.
export function computeTier(yearsOfExperience: number): MembershipTier {
  return yearsOfExperience > 12 ? 'seasoned_professional' : 'budding_entrepreneur';
}
