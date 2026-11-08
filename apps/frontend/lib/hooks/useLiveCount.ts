'use client';

import { useEffect, useRef, useState } from 'react';

// Live result count for a filter draft — the "Show 238 articles" figure in a FilterSheet. Debounced
// so ticking several boxes fires one request; only the latest request may set the result; null
// while loading, on failure (the count is a nicety, never a blocker) or when `fetchCount` is
// absent (e.g. a client-filtered admin list). `fetchCount` is read from a ref, so callers can pass
// an inline function without re-triggering the request on every render.
export function useLiveCount<T>(
  draft: T,
  fetchCount: ((draft: T) => Promise<number>) | undefined,
  delayMs = 250
): number | null {
  const [count, setCount] = useState<number | null>(null);
  const fetchRef = useRef(fetchCount);
  fetchRef.current = fetchCount;
  const hasFetcher = !!fetchCount;
  const requestId = useRef(0);

  useEffect(() => {
    const fetcher = fetchRef.current;
    const id = ++requestId.current;
    setCount(null);
    if (!fetcher) return;
    const timer = setTimeout(() => {
      fetcher(draft)
        .then((n) => {
          if (id === requestId.current) setCount(n);
        })
        .catch(() => {
          // Leave it null; the apply button falls back to "Show {noun}".
        });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [draft, hasFetcher, delayMs]);

  return count;
}
