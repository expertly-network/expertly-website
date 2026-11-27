'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  HERO_SEARCH_BUTTON_CLASS,
  HERO_SEARCH_CLASS,
  HERO_SEARCH_INPUT_CLASS,
  HeroSearchDot,
} from '@/components/layout/PageHero';
import { DEFAULT_SORT, filtersToSearchParams } from '@/lib/members/search-params';
import { usePhoneText } from '@/lib/hooks/usePhoneText';

// The member dashboard hero's search (dashboard.html): a plain keyword search of the member
// directory, not AI search. Submitting opens /members with the same `q` filter the directory's
// own hero search uses; an empty box just opens the directory.
export function DashboardHeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const placeholder = usePhoneText('Search members by name, practice, location, firm…', 'Name, practice, city…');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = filtersToSearchParams({ q: q.trim() || undefined, serviceId: [], country: [], sort: DEFAULT_SORT });
    router.push(`/members${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <form onSubmit={onSubmit} role="search" className={HERO_SEARCH_CLASS}>
      <HeroSearchDot />
      <label htmlFor="dashboard-search" className="sr-only">
        Search members
      </label>
      <input
        id="dashboard-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        type="search"
        enterKeyHint="search"
        maxLength={100}
        className={HERO_SEARCH_INPUT_CLASS}
      />
      <button type="submit" className={HERO_SEARCH_BUTTON_CLASS}>
        Find →
      </button>
    </form>
  );
}
