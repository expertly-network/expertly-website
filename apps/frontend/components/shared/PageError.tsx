'use client';

import { Button } from '@/components/ui';

// Shared body for route error boundaries. Never renders error.message: it's whatever the API or a
// library threw (e.g. Fastify's "...is exceeding the max param length"), which is meaningless to a
// visitor and can leak internals. The digest is Next's opaque server-error id — safe to show, and
// it lets support match a report to the server log.
export function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-4 px-6 py-24 text-center">
      <h2 className="text-title text-ink">We couldn&apos;t load this page.</h2>
      <p className="text-sm leading-relaxed text-ink-3">
        Something went wrong on our side. Please try again in a moment. If it keeps happening,
        head back to the homepage and try from there.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button href="/" variant="secondary">
          Go to homepage
        </Button>
      </div>
      {error.digest && (
        <p className="mt-2 text-caption text-ink-3">Reference: {error.digest}</p>
      )}
    </div>
  );
}
