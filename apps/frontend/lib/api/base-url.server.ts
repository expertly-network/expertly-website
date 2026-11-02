import { headers } from 'next/headers';
import { getApiUrl } from '@/lib/env';

// Server Components / server-side fetches — the deployment's runtime API_URL (lib/env.ts). Reading
// headers() keeps every caller rendered per request, so a page is never prerendered at build time,
// when the runtime environment (and usually the API itself) isn't available. Kept in its own file —
// any module that imports next/headers can't be part of a Client Component's bundle, even
// indirectly.
export async function getApiBaseUrlServer(): Promise<string> {
  await headers();
  return getApiUrl();
}
