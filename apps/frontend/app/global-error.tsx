'use client';

import './globals.css';
import { PageError } from '@/components/shared/PageError';

// Last-resort boundary for an error in the root layout itself. It replaces that layout, so it
// renders its own <html>/<body> and imports the global styles directly.
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-bg text-ink font-sans">
        <PageError {...props} />
      </body>
    </html>
  );
}
