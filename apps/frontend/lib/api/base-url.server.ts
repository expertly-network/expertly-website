import { headers } from 'next/headers';
import { BUILD_TIME_API_URL } from '@/lib/api/base-url.shared';

// Server Components / server-side fetches — the deployment's runtime API_URL. Reading headers()
// keeps every caller rendered per request, so a page is never prerendered at build time, when the
// runtime environment (and usually the API itself) isn't available. Kept in its own file — any
// module that imports next/headers can't be part of a Client Component's bundle, even indirectly.
export async function getApiBaseUrlServer(): Promise<string> {
  await headers();
  return process.env.API_URL || BUILD_TIME_API_URL;
}
