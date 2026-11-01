'use client';

import { SearchBox } from '@/components/search/SearchBox';
import { HERO_SEARCH_CLASS, HeroSearchDot } from '@/components/layout/PageHero';

// Inline AI search scoped to articles: type, press Enter, results open in the search modal.
export function ArticlesHeroSearch() {
  return (
    <SearchBox
      scope="articles"
      placeholder="Transfer pricing insights for 2026"
      leading={<HeroSearchDot />}
      className={HERO_SEARCH_CLASS}
    />
  );
}
