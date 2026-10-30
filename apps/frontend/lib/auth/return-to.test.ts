import { describe, expect, it } from 'vitest';
import { loginHref, safeReturnTo } from './return-to';

describe('safeReturnTo', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/members/jane-doe?tab=contact#reviews', '/members/jane-doe?tab=contact#reviews'],
    ['/articles?q=tax%20tips&page=2', '/articles?q=tax%20tips&page=2'],
    ['/', '/'],
    // An encoded tab stays an encoded path segment — same-origin, not a host.
    ['/%09/evil.com', '/%09/evil.com'],
    // Dot segments are resolved before the auth-page check, not left for the router.
    ['/members/../dashboard', '/dashboard'],
  ])('keeps the same-origin path %j', (raw, expected) => {
    expect(safeReturnTo(raw)).toBe(expected);
  });

  it.each([
    '//evil.com',
    '//evil.com/path',
    '/\\evil.com',
    '\\\\evil.com',
    '/\t/evil.com',
    // What `/%09/evil.com` becomes once a query-string parser decodes it.
    decodeURIComponent('/%09/evil.com'),
    '/\n/evil.com',
    '/\r/evil.com',
    '/\u0000x',
    'https://evil.com',
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'evil.com',
    '',
    null,
    undefined,
  ])('falls back to / for %j', (raw) => {
    expect(safeReturnTo(raw)).toBe('/');
  });

  it.each([
    '/login',
    '/login?returnTo=/admin',
    '/auth/callback',
    '/forgot-password',
    '/reset-password',
    '/reset-password/',
    '/x/../login',
  ])('never returns to an auth page: %j', (raw) => {
    expect(safeReturnTo(raw)).toBe('/');
  });

  it('does not treat a path that only starts with an auth word as an auth page', () => {
    expect(safeReturnTo('/login-help')).toBe('/login-help');
    expect(safeReturnTo('/authors')).toBe('/authors');
  });
});

describe('loginHref', () => {
  it('encodes a safe destination and drops an unsafe one', () => {
    expect(loginHref('/members/jane?tab=x')).toBe('/login?returnTo=%2Fmembers%2Fjane%3Ftab%3Dx');
    expect(loginHref('//evil.com')).toBe('/login');
    expect(loginHref('/')).toBe('/login');
  });
});
