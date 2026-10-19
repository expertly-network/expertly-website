'use client';

import { SearchBox } from '@/components/search/SearchBox';

// Inline AI search scoped to articles: type, press Enter, results open in the search modal.
export function ArticlesHeroSearch() {
  return (
    <SearchBox
      scope="articles"
      placeholder="Transfer pricing insights for 2026"
      leading={<span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-accent" />}
      className="mt-8 max-w-xl rounded-input border border-line-2 bg-bg-card py-2 pl-4 pr-2 transition-colors focus-within:border-ink hover:border-line"
    />
  );
}
