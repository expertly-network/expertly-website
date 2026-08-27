// Prototype's own price buckets (design/static_html/members.html's
// PRICE_RANGES), converted to the contract's rateMinCents/rateMaxCents
// (×100). The '600 and up' bucket omits rateMaxCents entirely rather than
// sending an arbitrary ceiling — GET /v1/members treats a missing param as
// "no upper bound", which is the correct semantics here, not the
// prototype's internal 999999 sentinel.
export interface RateBucket {
  label: string;
  rateMinCents?: number;
  rateMaxCents?: number;
}

export const RATE_BUCKETS: RateBucket[] = [
  { label: 'Under $300/hr', rateMaxCents: 30_000 },
  { label: '$300 – $400/hr', rateMinCents: 30_000, rateMaxCents: 40_000 },
  { label: '$400 – $500/hr', rateMinCents: 40_000, rateMaxCents: 50_000 },
  { label: '$500 – $600/hr', rateMinCents: 50_000, rateMaxCents: 60_000 },
  { label: '$600/hr and up', rateMinCents: 60_000 },
];
