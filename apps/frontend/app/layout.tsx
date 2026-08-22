import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
