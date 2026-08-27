'use client';

import { useState } from 'react';
import { SearchModal } from '@/components/home/SearchModal';
import type { MemberListItemDto } from '@shared/member';
import type { ArticleListItemDto } from '@shared/article';

// Matches design/static_html/articles.html's hero search bar visually, but — same call as
// AiSearchTeaser on the home page — made genuinely functional instead of reproducing its
// decorative rotating-placeholder-only behavior: clicking opens the same real cross-entity
// SearchModal the home page uses, rather than a second non-functional decoration.
export function ArticlesHeroSearch({
  members,
  articles,
}: {
  members: MemberListItemDto[];
  articles: ArticleListItemDto[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-8 flex w-full max-w-xl items-center gap-3 rounded-input border border-line-2 bg-bg-card px-4 py-3.5 text-left transition-colors hover:border-line"
      >
        <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-accent" />
        <span className="flex-1 text-sm text-ink-3">Transfer pricing insights for 2026</span>
        <span className="flex-none rounded-input bg-ink px-4 py-2 text-sm font-medium text-bg">
          Find →
        </span>
      </button>

      <SearchModal open={open} onClose={() => setOpen(false)} members={members} articles={articles} />
    </>
  );
}
