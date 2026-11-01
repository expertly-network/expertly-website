import type { MetadataRoute } from 'next';
import { getArticlesServer } from '@/lib/api/server';
import { getSiteUrlOrDefault } from '@/lib/env';

// Regenerated at most hourly; articles are the content search engines should find.
export const revalidate = 3600;

const PAGE_SIZE = 50; // the articles API's maximum
const MAX_PAGES = 200; // safety bound: 10,000 articles

// Public pages plus every published article (member profiles need a sign-in, so they're left out).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrlOrDefault();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${site}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${site}/articles`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${site}/events`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${site}/members`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${site}/membership`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${site}/perks`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${site}/templates`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${site}/learnings`, changeFrequency: 'weekly', priority: 0.5 },
  ];

  const articles: MetadataRoute.Sitemap = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { items, total } = await getArticlesServer({ page, pageSize: PAGE_SIZE });
      for (const a of items) {
        articles.push({
          url: `${site}/articles/${a.slug}`,
          lastModified: new Date(a.updatedAt),
          changeFrequency: 'monthly',
          priority: 0.8,
        });
      }
      if (items.length < PAGE_SIZE || articles.length >= total) break;
    }
  } catch {
    // The API being down shouldn't take the sitemap down; serve the static pages.
  }
  return [...staticPages, ...articles];
}
