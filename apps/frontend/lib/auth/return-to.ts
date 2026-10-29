// Post-login destinations come from the URL (`?returnTo=`), so they're attacker-controllable:
// only same-origin paths are honoured, and never the auth pages themselves (avoids a login loop).
// The check resolves the value with the same WHATWG URL parser the browser (and Next's router)
// will use, rather than matching string prefixes: the parser strips tab/CR/LF and treats `\` like
// `/`, so prefix checks miss inputs such as "/\t/evil.com", which resolves to //evil.com.
const AUTH_PATHS = ['/login', '/auth', '/forgot-password', '/reset-password'];

// Placeholder origin used only to resolve the path; never navigated to.
const BASE = 'http://return-to.invalid';

export function safeReturnTo(raw: string | null | undefined): string {
  // Control characters and backslashes have no business in a path we generated.
  if (!raw || !raw.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(raw)) return '/';

  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return '/';
  }
  if (url.origin !== BASE) return '/';
  if (AUTH_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}

export function loginHref(returnTo: string): string {
  const target = safeReturnTo(returnTo);
  return target === '/' ? '/login' : `/login?returnTo=${encodeURIComponent(target)}`;
}
