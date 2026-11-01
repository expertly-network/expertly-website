'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  HERO_SEARCH_BUTTON_CLASS,
  HERO_SEARCH_CLASS,
  HERO_SEARCH_INPUT_CLASS,
  HeroSearchDot,
} from '@/components/layout/PageHero';
import { filtersToSearchParams, type MemberFilters } from '@/lib/members/search-params';

// Submits the same q filter param the rest of the directory's URL-driven filter state uses.
export function DirectoryHeroSearch({ filters }: { filters: MemberFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filters.q ?? '');

  // The URL is the source of truth — when it changes elsewhere (e.g. "Reset filters" clears every
  // param), the box follows instead of keeping stale text like "zzzxqq".
  useEffect(() => {
    setQ(filters.q ?? '');
  }, [filters.q]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = filtersToSearchParams({ ...filters, q: q.trim() || undefined });
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <form onSubmit={onSubmit} role="search" className={HERO_SEARCH_CLASS}>
      <HeroSearchDot />
      <label htmlFor="directory-search" className="sr-only">
        Search members
      </label>
      <input
        id="directory-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, practice, location, firm…"
        type="search"
        className={HERO_SEARCH_INPUT_CLASS}
      />
      <button type="submit" className={HERO_SEARCH_BUTTON_CLASS}>
        Find →
      </button>
    </form>
  );
}
