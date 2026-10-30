'use client';

import { PageError } from '@/components/shared/PageError';

export default function ArticlesError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError {...props} />;
}
