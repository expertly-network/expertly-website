import type { ApplicationRegion } from '@shared/membership-application';

// Region is a business classification derived from country, not something the applicant picks
// directly — this is the server-side source of truth for that derivation. Keyed to exactly the
// countries offered by the frontend's COUNTRIES list (apps/frontend/components/apply/types.ts).
// 'Other' has no single defensible region and is intentionally left unmapped — see
// `deriveRegion` below for how that's handled at submit time.
const COUNTRY_TO_REGION: Record<string, ApplicationRegion> = {
  India: 'south_asia',
  Singapore: 'asia_pacific',
  'United Kingdom': 'europe',
  'United States': 'north_america',
  'United Arab Emirates': 'middle_east',
  Germany: 'europe',
  France: 'europe',
  Italy: 'europe',
  Spain: 'europe',
  Japan: 'asia_pacific',
  Australia: 'asia_pacific',
  Canada: 'north_america',
  Brazil: 'latin_america',
  China: 'asia_pacific',
  Ghana: 'africa',
  Nigeria: 'africa',
  Egypt: 'africa',
  'South Africa': 'africa',
};

// Returns null for an unmapped/blank country (e.g. 'Other') rather than guessing.
export function deriveRegion(country: string | null | undefined): ApplicationRegion | null {
  if (!country) return null;
  return COUNTRY_TO_REGION[country] ?? null;
}
