'use client';

import { Button } from '@/components/ui';

export default function MembersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-6 py-24 text-center">
      <h2 className="text-title text-ink">Something went wrong loading this page.</h2>
      <p className="text-sm text-ink-3">{error.message || 'Please try again.'}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
