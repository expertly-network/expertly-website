'use client';

import { useState } from 'react';
import { SearchModal } from '@/components/home/SearchModal';
import type { MemberListItemDto } from '@shared/member';
import type { ArticleListItemDto } from '@shared/article';
import type { EventDto } from '@shared/event';

// Same call as ArticlesHeroSearch: matches design/static_html/events.html's hero search bar
// visually, but made genuinely functional via the shared SearchModal instead of reproducing
// its decorative rotating-placeholder-only behavior.
export function EventsHeroSearch({
  members,
  articles,
  events,
}: {
  members: MemberListItemDto[];
  articles: ArticleListItemDto[];
  events: EventDto[];
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
        <span className="flex-1 text-sm text-ink-3">International law events in Seoul</span>
        <span className="flex-none rounded-input bg-ink px-4 py-2 text-sm font-medium text-bg">
          Find →
        </span>
      </button>

      <SearchModal
        open={open}
        onClose={() => setOpen(false)}
        members={members}
        articles={articles}
        events={events}
      />
    </>
  );
}
