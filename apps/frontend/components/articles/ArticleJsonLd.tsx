import type { ArticleListItemDto } from '@shared/article';
import { getSiteUrlOrDefault } from '@/lib/env';

// schema.org Article structured data, so search engines can show the article with its author,
// date and image. A non-executing data block; `<` is escaped so content can't close the tag.
export function ArticleJsonLd({ article }: { article: ArticleListItemDto }) {
  const site = getSiteUrlOrDefault();
  const url = `${site}/articles/${article.slug}`;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    image: [article.coverImageUrl],
    datePublished: article.createdAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: url,
    url,
    articleSection: article.services.map((s) => s.name),
    keywords: [...article.services.map((s) => s.name), ...article.countries].join(', '),
    author: {
      '@type': 'Person',
      name: article.authorName,
      ...(article.authorSlug ? { url: `${site}/members/${article.authorSlug}` } : {}),
      ...(article.authorHeadline ? { jobTitle: article.authorHeadline } : {}),
      ...(article.authorFirmName ? { worksFor: { '@type': 'Organization', name: article.authorFirmName } } : {}),
    },
    publisher: { '@type': 'Organization', name: 'GrowXQ', url: site, logo: `${site}/icon.png` },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
