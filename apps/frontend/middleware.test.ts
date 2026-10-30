import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config, middleware } from './middleware';

const session = vi.hoisted(() => ({ userId: null as string | null, forwarded: [] as Record<string, string>[] }));

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn(async (_request: unknown, headers: Record<string, string>) => {
    session.forwarded.push(headers);
    return { response: NextResponse.next(), userId: session.userId };
  }),
}));

beforeEach(() => {
  session.userId = null;
  session.forwarded = [];
});

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(';').map((d) => {
      const [name, ...sources] = d.trim().split(/\s+/);
      return [name, sources];
    })
  );
}

async function cspFor(path = '/'): Promise<string> {
  const res = await middleware(new NextRequest(`https://growxq.test${path}`));
  const csp = res.headers.get('Content-Security-Policy');
  expect(csp).toBeTruthy();
  return csp as string;
}

describe('middleware CSP', () => {
  it('nonces scripts with a fresh value per request, forwarded to the renderer', async () => {
    const first = await cspFor();
    const second = await cspFor();
    const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonceOf(first)).toBeTruthy();
    expect(nonceOf(first)).not.toBe(nonceOf(second));
    // The same nonce reaches app/layout.tsx (x-nonce) and Next's renderer (request CSP header).
    expect(session.forwarded[0]['x-nonce']).toBe(nonceOf(first));
    expect(session.forwarded[0]['Content-Security-Policy']).toBe(first);
  });

  it('pins every directive that can run script or send data', async () => {
    const d = directives(await cspFor());
    expect(d.get('default-src')).toEqual(["'self'"]);
    expect(d.get('script-src')).toEqual(expect.arrayContaining(["'self'", "'strict-dynamic'", "'wasm-unsafe-eval'"]));
    expect(d.get('script-src')).not.toContain("'unsafe-inline'");
    expect(d.get('connect-src')).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://api.growxq.test',
        'https://project.supabase.test',
        'wss://project.supabase.test',
      ])
    );
    expect(d.get('frame-src')).toEqual(['https://www.youtube-nocookie.com']);
    expect(d.get('form-action')).toEqual(["'self'", 'https://project.supabase.test']);
    expect(d.get('object-src')).toEqual(["'none'"]);
    expect(d.get('frame-ancestors')).toEqual(["'none'"]);
    expect(d.get('base-uri')).toEqual(["'self'"]);
    expect(d.get('media-src')).toEqual(["'self'", 'blob:', 'https://project.supabase.test']);
  });

  it('redirects a signed-out visitor away from a protected page, keeping returnTo', async () => {
    const res = await middleware(new NextRequest('https://growxq.test/admin/members'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://growxq.test/login?returnTo=%2Fadmin%2Fmembers');
  });

  it('lets a signed-in user through to a protected page with the CSP set', async () => {
    session.userId = 'user-1';
    const res = await middleware(new NextRequest('https://growxq.test/dashboard'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('Content-Security-Policy')).toContain("'nonce-");
  });
});

describe('middleware matcher', () => {
  const [pattern] = config.matcher;
  // Next compiles the matcher with path-to-regexp; its `(...)` group is a plain regex group.
  const matches = (path: string) => new RegExp(`^${pattern}$`).test(path);

  it.each(['/', '/dashboard', '/members/jane-doe', '/articles/write', '/login', '/api/other'])('runs on %s', (path) => {
    expect(matches(path)).toBe(true);
  });

  it.each([
    '/api/health',
    '/_next/static/chunks/main.js',
    '/_next/image',
    '/fonts/brand/CormorantGaramond.woff2',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/images/hero.png',
    '/docs/terms.pdf',
  ])('skips %s', (path) => {
    expect(matches(path)).toBe(false);
  });
});
