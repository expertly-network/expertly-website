'use client';

import { useEffect } from 'react';
import { recordMemberProfileView } from '@/lib/api/members';

// Counts one view of this member's profile, at most once per browser tab session per profile, so
// refreshing or tabbing back doesn't inflate the number. Fired from the browser rather than the
// server render so link-preview crawlers and prefetches don't count. Renders nothing; a failed
// call is ignored — the reader never sees this.
export function ProfileViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `growxq:profile-viewed:${slug}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Storage blocked (private mode, disabled cookies): still count, just without the dedupe.
    }
    recordMemberProfileView(slug).catch(() => {});
  }, [slug]);
  return null;
}
