import type { ReactNode } from 'react';
import { HERO_SEARCH_CLASS, HERO_SEARCH_INPUT_CLASS, HeroSearchDot, PageHero } from '@/components/layout/PageHero';

// Perks / Templates / Learnings hero — the shared PageHero with a live-filter search box (no
// submit button; the list filters as you type).
export function ResourceHero({
  title,
  accent,
  children,
  search,
}: {
  title: string;
  accent: string;
  children: ReactNode;
  search?: { id: string; label: string; placeholder: string; value: string; onChange: (value: string) => void };
}) {
  return (
    <PageHero
      eyebrow="The GrowXQ advantage"
      title={
        <>
          {title} <span className="text-accent">{accent}</span>
        </>
      }
      lede={children}
      search={
        search && (
          <div role="search" className={HERO_SEARCH_CLASS}>
            <HeroSearchDot />
            <label htmlFor={search.id} className="sr-only">
              {search.label}
            </label>
            <input
              id={search.id}
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder}
              className={HERO_SEARCH_INPUT_CLASS}
            />
          </div>
        )
      }
      decoration={
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-0 hidden h-96 w-96 rounded-full border border-white/10 lg:block"
        >
          <div className="absolute inset-12 rounded-full border border-white/10" />
          <div className="absolute inset-24 rounded-full border border-white/10" />
        </div>
      }
    />
  );
}
