// Post-login destinations come from the URL (`?returnTo=`), so they're attacker-controllable:
// only same-origin paths are honoured, never `//evil.com` or `/\evil.com` (both of which browsers
// treat as protocol-relative), and never the auth pages themselves (avoids a login loop).
const AUTH_PATHS = ['/login', '/auth', '/forgot-password', '/reset-password'];

export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  const path = raw.split(/[?#]/)[0];
  if (AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return '/';
  return raw;
}

export function loginHref(returnTo: string): string {
  const target = safeReturnTo(returnTo);
  return target === '/' ? '/login' : `/login?returnTo=${encodeURIComponent(target)}`;
}
