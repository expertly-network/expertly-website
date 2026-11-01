// Pre-launch (SITE_LAUNCHED=false — see isSiteLaunched in lib/env.ts): the only pages that stay
// open. Everything else redirects — to /apply for a signed-in visitor, else to the teaser at `/`.
// /admin stays open so applications can be reviewed; it's admin-only on its own.
const PRELAUNCH_PREFIXES = [
  '/welcome',
  '/login',
  '/auth',
  '/forgot-password',
  '/reset-password',
  '/apply',
  '/legal',
  '/admin',
  '/api',
];

export function isOpenBeforeLaunch(pathname: string): boolean {
  return pathname === '/' || PRELAUNCH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// The founding-cohort coupon (backend: applications/constants/coupons.ts — a full first-year
// waiver). The teaser's CTA carries it as `?coupon=`; middleware remembers any such code in a
// cookie so it survives the sign-up / login / OAuth hops, and the wizard pre-fills it.
export const FOUNDING_COUPON_CODE = 'LAUNCH100';
export const COUPON_COOKIE = 'growxq_coupon';
export const COUPON_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** The code, upper-cased, if it looks like one — anything else is ignored (the backend validates). */
export function cleanCouponCode(raw: string | null | undefined): string | null {
  const code = raw?.trim().toUpperCase();
  return code && /^[A-Z0-9_-]{1,40}$/.test(code) ? code : null;
}

// Pre-launch, peer references are optional and the first one starts filled in with the founder's
// details (the founding cohort are people he invited); the applicant can edit or clear it.
export const FOUNDING_DEFAULT_REFERENCE = {
  name: 'Mukesh Kumar M',
  relationship: 'Friend / Colleague',
  email: 'mukeshlunawat@gmail.com',
  phone: '+91 98844 61718',
};
