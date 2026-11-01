// Typed, validated environment for every runtime (browser, server, middleware). Imported instead of
// reading `process.env.X!` inline, so a missing value fails loudly here with its name rather than
// as an opaque "Invalid URL" deep inside supabase-js.
//
// Two kinds of value:
// - NEXT_PUBLIC_* are inlined into the bundles at build time, so they must be read with a literal
//   `process.env.NEXT_PUBLIC_X` (a dynamic `process.env[name]` read is never inlined into the
//   browser bundle). `next build` refuses to run without them (next.config.js), so in production
//   these checks only ever fire in a hand-rolled build.
// - Runtime server config (API_URL, the site origin) is read per process from the real
//   environment, so one image can serve several deployments (see lib/api/base-url.shared.ts).
//
// No `next/headers` import here — this module is shared with Client Components.

function requirePublic(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see apps/frontend/.env.example).`);
  }
  return value;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** The Supabase project URL, without a trailing slash. */
export const SUPABASE_URL = stripTrailingSlash(
  requirePublic('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
);

/** The Supabase anon (publishable) key — safe in the browser. */
export const SUPABASE_ANON_KEY = requirePublic(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Reads a variable from the live process environment, not the build-time inlined copy. Server and
// middleware only — in the browser `process.env` is an empty shim.
function runtimeEnv(name: string): string | undefined {
  const value = typeof process !== 'undefined' ? process.env[name] : undefined;
  return value ? value : undefined;
}

const DEV_SITE_URL = 'http://localhost:3000';

// NEXT_PUBLIC_SITE_URL is this app's public origin — or, when one container serves several domains
// (e.g. https://expertly.network,https://dev.expertly.network), a comma-separated list of them,
// canonical first. Required in production; read at runtime first (Coolify env var), then the
// build-time value.
function siteOrigins(): string[] {
  const raw = runtimeEnv('NEXT_PUBLIC_SITE_URL') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const origins = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => stripTrailingSlash(entry));
  if (origins.length > 0) return origins;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing required environment variable NEXT_PUBLIC_SITE_URL (the public site origin).');
  }
  return [DEV_SITE_URL];
}

/**
 * This app's canonical public origin (no trailing slash), e.g. https://growxq.com. Server/middleware
 * only. Used wherever an absolute URL must point at *our* host.
 */
export function getSiteUrl(): string {
  return siteOrigins()[0];
}

/**
 * The configured origin whose host matches `requestHost` (the request's Host / X-Forwarded-Host),
 * else the canonical one. A client controls that header, so it can only ever select one of our own
 * configured origins — never redirect anywhere else.
 */
export function resolveSiteUrl(requestHost: string | null | undefined): string {
  const origins = siteOrigins();
  const host = requestHost?.split(',')[0]?.trim().toLowerCase();
  if (host) {
    const match = origins.find((origin) => {
      try {
        return new URL(origin).host.toLowerCase() === host;
      } catch {
        return false;
      }
    });
    if (match) return match;
  }
  return origins[0];
}

/** getSiteUrl() for non-security uses (metadata), which degrade instead of failing the request. */
export function getSiteUrlOrDefault(): string {
  try {
    return getSiteUrl();
  } catch {
    return DEV_SITE_URL;
  }
}

/** The backend API's base URL for this deployment (runtime API_URL, then the build-time value). */
export function getApiUrlRuntime(): string {
  return stripTrailingSlash(runtimeEnv('API_URL') ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
}

/**
 * The launch switch (runtime SITE_LAUNCHED, Coolify env var — flip it and restart, no rebuild).
 * `false` puts the site in pre-launch: only the teaser at `/`, sign-in and the application stay
 * open (see lib/launch.ts). Anything else, or unset, means launched — so local dev is unaffected.
 */
export function isSiteLaunched(): boolean {
  return runtimeEnv('SITE_LAUNCHED')?.trim().toLowerCase() !== 'false';
}
