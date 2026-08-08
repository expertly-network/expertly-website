import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
});

export const metadata: Metadata = {
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
