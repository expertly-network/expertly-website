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

/**
 * This app's own public origin (no trailing slash), e.g. https://growxq.com. Server/middleware only.
 * Used wherever a redirect or absolute URL must point at *our* host — never derived from the
 * request's Host / X-Forwarded-Host headers, which the client controls. Required in production;
 * read at runtime first (Coolify env var) and from the build-time value otherwise.
 */
export function getSiteUrl(): string {
  const value = runtimeEnv('NEXT_PUBLIC_SITE_URL') ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (value) return stripTrailingSlash(value);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing required environment variable NEXT_PUBLIC_SITE_URL (the public site origin).');
  }
  return DEV_SITE_URL;
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
