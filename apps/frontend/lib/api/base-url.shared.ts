// The frontend is a single built image served from multiple domains
// (expertly.network in production, dev.expertly.network for dev). Since
// NEXT_PUBLIC_* values are inlined into the client JS bundle at build time,
// one build can't carry a different API URL per domain via env vars — the
// browser never sees the container's runtime environment. Instead, the API
// host is derived from whichever domain is actually serving the page, at
// request time. See base-url.client.ts / base-url.server.ts.
export const API_HOSTS: Record<string, string> = {
  'expertly.network': 'https://api.expertly.network',
  'www.expertly.network': 'https://api.expertly.network',
  'dev.expertly.network': 'https://dev-api.expertly.network',
};

export const FALLBACK_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
