'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { filtersToSearchParams, type MemberFilters } from '@/lib/members/search-params';

// The directory hero's search bar — design/static_html/members.html's `.dir-search`/
// `.hero-search`. Submits the same `q` filter param the rest of the directory's URL-driven
// filter state already uses (`lib/members/search-params.ts`), so this is genuinely
// functional, not decorative. Dropped the design's rotating example-query placeholder
// animation — decorative-only, not worth the extra state for a search input.
export function DirectoryHeroSearch({ filters }: { filters: MemberFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filters.q ?? '');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = filtersToSearchParams({ ...filters, q: q.trim() || undefined });
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 rounded-2xl bg-bg-card p-2 pl-4 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)]"
    >
      <span aria-hidden="true" className="h-2 w-2 flex-none animate-pulse rounded-full bg-accent" />
      <label htmlFor="directory-search" className="sr-only">
        Search members
      </label>
      <input
        id="directory-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, practice, location, firm…"
        className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
      />
      <Button type="submit" className="flex-none">
        Find →
      </Button>
    </form>
  );
}
