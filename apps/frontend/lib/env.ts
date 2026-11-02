// Typed, validated environment for every runtime (browser, server, middleware). Imported instead of
// reading `process.env.X!` inline, so a missing value fails loudly here with its name rather than
// as an opaque "Invalid URL" deep inside supabase-js.
//
// Deployment config is runtime-only, never build-time: API_URL, SUPABASE_URL and SUPABASE_ANON_KEY
// are read per process from the container's environment (Coolify env vars), so one image runs every
// deployment (dev, production) against its own backend and Supabase project, and nothing about a
// deployment is baked into the bundle. The browser can't read process.env, so the root layout
// injects the same values as `window.__GROWXQ_CONFIG__` (publicConfigScript) and the browser
// branch of each getter reads them back. None of them is a secret — the anon key is public by
// design (RLS protects data).
//
// No `next/headers` import here — this module is shared with Client Components.

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

// Reads a variable from the live process environment. Server and middleware only — in the browser
// `process.env` is an empty shim. Always a dynamic `process.env[name]` read, so Next never inlines a
// build-time value.
function runtimeEnv(name: string): string | undefined {
  const value = typeof process !== 'undefined' ? process.env[name] : undefined;
  return value ? value : undefined;
}

function requireRuntime(name: string): string {
  const value = runtimeEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see apps/frontend/.env.example).`);
  }
  return value;
}

/** The deployment config the browser needs, injected by the root layout. */
export interface PublicConfig {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const PUBLIC_CONFIG_GLOBAL = '__GROWXQ_CONFIG__';

function browserConfig(): PublicConfig | null {
  if (typeof window === 'undefined') return null;
  const injected = (window as unknown as Record<string, unknown>)[PUBLIC_CONFIG_GLOBAL];
  if (!injected || typeof injected !== 'object') {
    throw new Error(`window.${PUBLIC_CONFIG_GLOBAL} is missing — the root layout must inject it.`);
  }
  return injected as PublicConfig;
}

const DEV_API_URL = 'http://localhost:4000';

/**
 * The backend API's base URL for this deployment (runtime API_URL). Outside production it defaults
 * to the local backend; in production a missing API_URL is an error, never a silent fallback.
 */
export function getApiUrl(): string {
  const config = browserConfig();
  if (config) return config.apiUrl;
  const value = runtimeEnv('API_URL');
  if (value) return stripTrailingSlash(value);
  if (process.env.NODE_ENV === 'production') return requireRuntime('API_URL');
  return DEV_API_URL;
}

/** The Supabase project URL (runtime SUPABASE_URL), without a trailing slash. */
export function getSupabaseUrl(): string {
  const config = browserConfig();
  if (config) return config.supabaseUrl;
  return stripTrailingSlash(requireRuntime('SUPABASE_URL'));
}

/** The Supabase anon (publishable) key (runtime SUPABASE_ANON_KEY) — safe in the browser. */
export function getSupabaseAnonKey(): string {
  const config = browserConfig();
  if (config) return config.supabaseAnonKey;
  return requireRuntime('SUPABASE_ANON_KEY');
}

/**
 * Server only: the inline script the root layout renders so Client Components get this
 * deployment's config. `<` is escaped so an env value can never close the script tag.
 */
export function publicConfigScript(): string {
  const config: PublicConfig = {
    apiUrl: getApiUrl(),
    supabaseUrl: getSupabaseUrl(),
    supabaseAnonKey: getSupabaseAnonKey(),
  };
  return `window.${PUBLIC_CONFIG_GLOBAL}=${JSON.stringify(config).replace(/</g, '\\u003c')};`;
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

/**
 * The launch switch (runtime SITE_LAUNCHED, Coolify env var — flip it and restart, no rebuild).
 * `false` puts the site in pre-launch: only the teaser at `/`, sign-in and the application stay
 * open (see lib/launch.ts). Anything else, or unset, means launched — so local dev is unaffected.
 */
export function isSiteLaunched(): boolean {
  return runtimeEnv('SITE_LAUNCHED')?.trim().toLowerCase() !== 'false';
}
