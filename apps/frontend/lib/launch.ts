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
