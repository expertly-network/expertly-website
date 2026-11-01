'use client';

import { SearchBox } from '@/components/search/SearchBox';
import { HERO_SEARCH_CLASS, HeroSearchDot } from '@/components/layout/PageHero';

// The member dashboard hero's search (dashboard.html): AI search across the whole network —
// type, press Enter, results open in the search modal.
export function DashboardHeroSearch() {
  return (
    <SearchBox
      placeholder="Cross-border tax advisor under $500/hr"
      buttonLabel="Find →"
      leading={<HeroSearchDot />}
      className={HERO_SEARCH_CLASS}
    />
  );
}
