'use client';

import { PageError } from '@/components/shared/PageError';

// Error boundary for routes outside the (shell) group — /apply, /login, /forgot-password,
// /reset-password, /auth/* — which would otherwise fall through to Next's bare default page.
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError {...props} />;
}
