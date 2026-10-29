'use client';

import { PageError } from '@/components/shared/PageError';

// Generic error boundary for the (shell) route group, for any nested route (e.g. the homepage)
// that doesn't have its own more specific one.
export default function ShellError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError {...props} />;
}
