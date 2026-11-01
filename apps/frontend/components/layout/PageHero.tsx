import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';

// One search-bar look for every page hero (articles, events, members, perks, templates,
// learnings): white pill, same height whether or not it has a submit button.
export const HERO_SEARCH_CLASS =
  'flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-bg-card py-2 pl-4 pr-2 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)] focus-within:ring-[3px] focus-within:ring-accent';
export const HERO_SEARCH_INPUT_CLASS =
  'min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden';
export const HERO_SEARCH_BUTTON_CLASS =
  'flex-none rounded-input bg-ink px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-40';

export function HeroSearchDot() {
  return <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-accent" />;
}

// The dark hero at the top of every browse page, so title size, spacing and the search bar are
// identical across pages. `decoration` is optional desktop-only art behind the content.
// A "← label" link for PageHero's `back` slot.
export function HeroBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-white/65 transition-colors hover:text-white"
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}

export function PageHero({
  eyebrow,
  title,
  lede,
  search,
  action,
  back,
  children,
  decoration,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  search?: ReactNode;
  /** A button on the right of the title block (below it on small screens), e.g. the dashboard's. */
  action?: ReactNode;
  /** A "← Back to …" link above the eyebrow, for detail pages. */
  back?: ReactNode;
  /** Extra content under the text, e.g. a row of links. */
  children?: ReactNode;
  decoration?: ReactNode;
}) {
  const text = (
    <>
      {back && <div className="mb-5">{back}</div>}
      <Eyebrow dark>{eyebrow}</Eyebrow>
      <h1 className="font-brand mt-3 max-w-4xl break-words text-headline text-white">{title}</h1>
      {lede && <p className="mt-4 max-w-2xl text-lede text-white/65">{lede}</p>}
    </>
  );
  return (
    <section className="relative overflow-hidden bg-ink py-12 sm:py-16">
      {decoration}
      <PageContainer className="relative">
        {action ? (
          <div className="flex flex-wrap items-end justify-between gap-7">
            <div className="min-w-0 max-w-3xl">{text}</div>
            <div className="flex-none">{action}</div>
          </div>
        ) : (
          text
        )}
        {children && <div className="mt-6">{children}</div>}
        {search && <div className="mt-8 max-w-2xl">{search}</div>}
      </PageContainer>
    </section>
  );
}
