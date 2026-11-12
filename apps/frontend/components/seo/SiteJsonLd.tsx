import { FAVICON_PNG_SRC } from '@/lib/brand';
import { getSiteUrlOrDefault } from '@/lib/env';

// schema.org Organization + WebSite structured data for the home page, so search engines can show
// the brand name, logo and social profile. Same non-executing data block as ArticleJsonLd.
export function SiteJsonLd() {
  const site = getSiteUrlOrDefault();
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${site}/#organization`,
        name: 'GrowXQ',
        url: site,
        logo: `${site}${FAVICON_PNG_SRC}`,
        sameAs: ['https://www.linkedin.com/company/expertly-network'],
      },
      {
        '@type': 'WebSite',
        '@id': `${site}/#website`,
        name: 'GrowXQ',
        url: site,
        publisher: { '@id': `${site}/#organization` },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
