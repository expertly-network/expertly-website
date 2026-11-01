import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getSiteUrlOrDefault, isSiteLaunched, resolveSiteUrl } from '@/lib/env';

// Only the canonical domain is indexed, and only once launched; any other configured host (e.g. the
// dev domain), or any host before launch, asks crawlers to stay out.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = getSiteUrlOrDefault();
  const h = await headers();
  const host = resolveSiteUrl(h.get('x-forwarded-host') ?? h.get('host'));
  if (host !== site || !isSiteLaunched()) return { rules: { userAgent: '*', disallow: '/' } };

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/consultations', '/apply', '/articles/write', '/api/', '/auth/', '/login'],
    },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
