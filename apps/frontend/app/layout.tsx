import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
});

// metadataBase resolves any relative `openGraph.url`/`images` a route's own generateMetadata
// returns (see articles/[id]/page.tsx) into the absolute URLs link-preview crawlers require —
// without it those fields silently fail to resolve instead of erroring. NEXT_PUBLIC_SITE_URL is
// new (this is the first metadata feature that needed the app's own public origin); unset in
// dev, where OG previews can't work anyway since crawlers can't reach localhost.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Expertly',
  description: 'Connecting clients with vetted expert members',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${archivo.variable}`}>
      <body className="bg-bg text-ink font-sans">{children}</body>
    </html>
  );
}
