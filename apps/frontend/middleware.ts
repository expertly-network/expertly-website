import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Routes that require a signed-in user. Add more prefixes here as new protected
// pages ship (e.g. '/peer-connect', '/my-consultations').
const PROTECTED_PREFIXES = ['/dashboard', '/apply'];

// Opt-out, not opt-in: every signed-in-but-unconsented request gets redirected to the consent
// gate EXCEPT these — the gate page itself (avoid an infinite loop), the OAuth callback (still
// mid-flow, hasn't rendered anything yet), and the login/recovery routes (a logged-in-but-
// unconsented user hitting these isn't useful to redirect there anyway, but they shouldn't be
// blocked from password recovery either). See docs/auth.md.
const CONSENT_GATE_ALLOWLIST = ['/auth', '/login', '/forgot-password', '/reset-password'];

export async function middleware(request: NextRequest) {
  const { response, user, consentGiven } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const isAllowlisted = CONSENT_GATE_ALLOWLIST.some((prefix) => pathname.startsWith(prefix));
  if (user && !consentGiven && !isAllowlisted) {
    const redirectUrl = new URL('/auth/confirm-signup', request.url);
    redirectUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
