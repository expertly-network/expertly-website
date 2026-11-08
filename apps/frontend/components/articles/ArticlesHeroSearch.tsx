'use client';

import { SearchBox } from '@/components/search/SearchBox';
import { HERO_SEARCH_CLASS, HeroSearchDot } from '@/components/layout/PageHero';
import { usePhoneText } from '@/lib/hooks/usePhoneText';

// Inline AI search scoped to articles: type, press Enter, results open in the search modal.
export function ArticlesHeroSearch() {
  // The full example is cut off beside the Find button at phone widths.
  const placeholder = usePhoneText('Transfer pricing insights for 2026', 'Search transfer pricing…');
  return (
    <SearchBox scope="articles" placeholder={placeholder} leading={<HeroSearchDot />} className={HERO_SEARCH_CLASS} />
  );
}
