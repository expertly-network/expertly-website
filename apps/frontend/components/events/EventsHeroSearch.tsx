'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SearchModal } from '@/components/home/SearchModal';
import {
  HERO_SEARCH_BUTTON_CLASS,
  HERO_SEARCH_CLASS,
  HERO_SEARCH_INPUT_CLASS,
  HeroSearchDot,
} from '@/components/layout/PageHero';

// Keyword search that filters the events list below straight away (?q=, GET /v1/events?q=). The
// slower, conversational AI search is one click away underneath, seeded with the same text.
export function EventsHeroSearch({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(initialQuery);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    router.push(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false });
  }

  return (
    <>
      <form onSubmit={submit} role="search" className={HERO_SEARCH_CLASS}>
        <HeroSearchDot />
        <label htmlFor="events-search" className="sr-only">
          Search events
        </label>
        <input
          id="events-search"
          type="search"
          enterKeyHint="search"
          maxLength={200}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search events, e.g. GST, transfer pricing, Singapore…"
          className={HERO_SEARCH_INPUT_CLASS}
        />
        <button type="submit" className={HERO_SEARCH_BUTTON_CLASS}>
          Find →
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setAiQuery(text.trim());
          setAiOpen(true);
        }}
        className="mt-3 text-sm text-white/60 transition-colors hover:text-white"
      >
        <span aria-hidden="true" className="text-accent">
          ✦
        </span>{' '}
        Prefer to ask in plain English? <span className="underline underline-offset-2">Ask GrowXQ AI</span>
      </button>
      <SearchModal open={aiOpen} onClose={() => setAiOpen(false)} initialQuery={aiQuery} scope="events" />
    </>
  );
}
