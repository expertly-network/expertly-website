'use client';

import { PageError } from '@/components/shared/PageError';

// /apply sits outside the (shell) group, so this boundary keeps a failed draft/categories load
// inside the apply flow instead of falling through to the root error page.
export default function ApplyError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-bg-alt">
      <PageError {...props} />
    </main>
  );
}
