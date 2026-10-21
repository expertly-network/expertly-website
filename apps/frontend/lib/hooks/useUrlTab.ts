'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

// Tab state mirrored into `?tab=` so a tab survives refresh and can be deep-linked. The default
// tab keeps a clean URL (no param). `keys` are the URL values; anything unknown falls back.
export function useUrlTab<T extends string>(keys: readonly T[], defaultKey: T): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get('tab');
  const [active, setActive] = useState<T>(
    fromUrl && (keys as readonly string[]).includes(fromUrl) ? (fromUrl as T) : defaultKey
  );

  function select(next: T) {
    setActive(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === defaultKey) params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return [active, select];
}
