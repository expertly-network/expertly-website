// The API's base URL is runtime configuration, not code: each deployment (production, dev, …) runs
// the same frontend image with its own `API_URL` environment variable. NEXT_PUBLIC_* values can't
// do this — they're inlined into the JS bundle at build time, so one build would carry one URL.
// The server reads API_URL per request (base-url.server.ts) and hands it to the browser through a
// tiny inline script in the root layout (base-url.client.ts reads it back).
//
// Fallbacks, in order: the build-time NEXT_PUBLIC_API_URL (local dev's .env), then localhost.
export const BUILD_TIME_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Global the root layout's inline script sets for Client Components.
export const API_URL_GLOBAL = '__API_URL__';
