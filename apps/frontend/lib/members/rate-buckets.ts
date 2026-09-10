// The top bucket omits rateMaxCents entirely for "no upper bound", rather than an arbitrary ceiling.
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
