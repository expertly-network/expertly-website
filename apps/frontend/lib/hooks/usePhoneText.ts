'use client';

import { useEffect, useState } from 'react';

// Picks shorter copy below the `sm` breakpoint (640px) — e.g. a search placeholder that would be
// cut off beside its button on a phone. Starts with `full` and switches after mount, so server and
// client markup always match (no hydration warning); only text that can change late belongs here.
export function usePhoneText(full: string, phone: string): string {
  const [text, setText] = useState(full);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setText(mq.matches ? phone : full);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [full, phone]);
  return text;
}
