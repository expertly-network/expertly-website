'use client';

import { PageError } from '@/components/shared/PageError';

export default function EventsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError {...props} />;
}
