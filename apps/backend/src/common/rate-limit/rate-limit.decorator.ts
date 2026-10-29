import { SetMetadata } from '@nestjs/common';

export interface RateLimitRule {
  /** Max requests allowed within the window. */
  limit: number;
  windowSeconds: number;
}

export interface RateLimitPolicy {
  /** Counter name — routes sharing a bucket share one allowance (e.g. every AI endpoint). */
  bucket: string;
  rules: RateLimitRule[];
}

export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Per-user limit for a route or controller (signed-in callers only — see RateLimitGuard for why
 * anonymous requests aren't counted here). Every rule must hold (e.g. a burst limit per minute AND a sustained limit per hour). Routes
 * without this decorator still get DEFAULT_RATE_LIMIT (see RateLimitGuard).
 */
export const RateLimit = (bucket: string, ...rules: RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_KEY, { bucket, rules } satisfies RateLimitPolicy);

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Named policies, so related routes share one allowance and the numbers live in one place.
export const RATE_LIMITS = {
  /** Paid LLM calls: AI drafting, refining, follow-up questions, topic suggestions. */
  ai: [{ limit: 10, windowSeconds: MINUTE }, { limit: 60, windowSeconds: HOUR }, { limit: 200, windowSeconds: DAY }],
  /** The full AI draft (web research + long generation) is the most expensive call. */
  aiDraft: [{ limit: 3, windowSeconds: MINUTE }, { limit: 20, windowSeconds: HOUR }, { limit: 50, windowSeconds: DAY }],
  /** Paid LinkedIn scrape (n8n). An applicant needs it once or twice. */
  linkedinImport: [{ limit: 5, windowSeconds: HOUR }, { limit: 10, windowSeconds: DAY }],
  /** Third-party API with a small quota (Unsplash). */
  coverImages: [{ limit: 20, windowSeconds: MINUTE }, { limit: 200, windowSeconds: HOUR }],
  /** Stops brute-forcing coupon codes. */
  coupon: [{ limit: 10, windowSeconds: MINUTE }, { limit: 30, windowSeconds: HOUR }],
  /** File uploads (storage cost, magic-byte sniffing). */
  upload: [{ limit: 20, windowSeconds: MINUTE }, { limit: 200, windowSeconds: DAY }],
  /** Content a user creates that other people see or an admin must review. */
  write: [{ limit: 20, windowSeconds: MINUTE }, { limit: 300, windowSeconds: DAY }],
} satisfies Record<string, RateLimitRule[]>;

/** Applies to every route that has no @RateLimit of its own. */
export const DEFAULT_RATE_LIMIT: RateLimitPolicy = {
  bucket: 'default',
  rules: [{ limit: 300, windowSeconds: MINUTE }],
};
