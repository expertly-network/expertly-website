import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import './globals.css';
import { getApiBaseUrlServer } from '@/lib/api/base-url.server';
import { API_URL_GLOBAL } from '@/lib/api/base-url.shared';
import { getSiteUrlOrDefault } from '@/lib/env';

const brandSerif = localFont({
  // Variable (wght 300–700) woff2, subset to Latin + Latin-1 + general punctuation, ₹, €, ™ (64KB
  // vs the 1.2MB full TTF). The profile PDF embeds its own CormorantGaramond-Medium.ttf instead.
  src: '../public/fonts/brand/CormorantGaramond.woff2',
  variable: '--font-brand-serif',
  display: 'swap',
  weight: '300 700',
});

// metadataBase resolves any relative `openGraph.url`/`images` a route's own generateMetadata
// returns (see articles/[slug]/page.tsx) into the absolute URLs link-preview crawlers require —
// without it those fields silently fail to resolve instead of erroring. NEXT_PUBLIC_SITE_URL is
// new (this is the first metadata feature that needed the app's own public origin); unset in
// dev, where OG previews can't work anyway since crawlers can't reach localhost.
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrlOrDefault()),
  title: 'GrowXQ',
  description: 'Connecting clients with vetted expert members',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce from middleware.ts. Reading headers() makes every route dynamic — which a
  // nonce requires anyway (a prerendered page can't carry a fresh nonce), so this is the decision,
  // not an accident: no route is statically prerendered.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  // Runtime API_URL for Client Components (see lib/api/base-url.shared.ts). `<` is escaped so an
  // env value can never close the script tag.
  const apiUrlScript = `window.${API_URL_GLOBAL}=${JSON.stringify(await getApiBaseUrlServer()).replace(/</g, '\\u003c')};`;

  return (
    <html lang="en" className={`${GeistSans.variable} ${brandSerif.variable}`}>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: apiUrlScript }} />
      </head>
      <body className="bg-bg text-ink font-sans">{children}</body>
    </html>
  );
}
