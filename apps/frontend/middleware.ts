import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { SUPABASE_URL, getApiUrlRuntime, getSiteUrlOrDefault } from '@/lib/env';

// Routes that require a signed-in user. Add more prefixes here as new protected
// pages ship (e.g. '/peer-connect').
const PROTECTED_PREFIXES = ['/dashboard', '/apply', '/admin', '/articles/write', '/consultations'];

const isDev = process.env.NODE_ENV !== 'production';

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/**
 * Per-request Content-Security-Policy. Scripts run only with this request's nonce — Next adds it to
 * its own bootstrap/chunk scripts automatically when it sees the header, and app/layout.tsx puts it
 * on the one inline script we write; 'strict-dynamic' then trusts the chunks those load.
 *
 * - 'wasm-unsafe-eval': the profile PDF export (react-pdf → yoga-layout) compiles WebAssembly.
 *   It permits WebAssembly compilation only, not eval().
 * - style-src 'unsafe-inline': Next and React inject inline style attributes/tags; style
 *   injection can't run script.
 * - img-src https:: article covers (Unsplash picks or member-supplied https URLs) and admin-entered
 *   resource images are arbitrary https hosts by contract, so images aren't pinned to a host list.
 *   Images can't execute script; everything that can (script/connect/frame/form) is pinned.
 */
function contentSecurityPolicy(nonce: string): string {
  const supabase = originOf(SUPABASE_URL);
  const supabaseWs = supabase.replace(/^http/, 'ws');
  const api = originOf(getApiUrlRuntime());

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:', ...(isDev ? ['http://localhost:*', 'http://127.0.0.1:*'] : [])],
    'media-src': ["'self'", 'blob:', supabase],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", api, supabase, supabaseWs, ...(isDev ? ['ws:'] : [])],
    'frame-src': ['https://www.youtube-nocookie.com'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", supabase],
    'frame-ancestors': ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.filter(Boolean).join(' ')}`)
    .join('; ');
  // Only for a site actually served over https: on a plain-http origin (a local `next start`) it
  // would rewrite same-origin redirects and links to https://localhost, which has no TLS.
  const httpsSite = getSiteUrlOrDefault().startsWith('https://');
  return isDev || !httpsSite ? policy : `${policy}; upgrade-insecure-requests`;
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  // The nonce reaches Server Components as a request header (read in app/layout.tsx); Next's renderer
  // reads the CSP request header to nonce its own scripts.
  const { response, userId } = await updateSession(request, {
    'x-nonce': nonce,
    'Content-Security-Policy': csp,
  });

  const isProtected = PROTECTED_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));

  if (isProtected && !userId) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('returnTo', request.nextUrl.pathname);
    const redirect = NextResponse.redirect(redirectUrl);
    // Keep any cookies a refresh attempt cleared/rewrote (e.g. an expired session being removed).
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Skips Next's static/image assets, the deploy healthcheck, public/fonts, and any static file by
  // extension — none of them render HTML (no CSP needed) or need a session refresh.
  matcher: [
    '/((?!_next/static|_next/image|api/health|fonts/|favicon.ico|.*\\.(?:ttf|woff2?|otf|pdf|svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
