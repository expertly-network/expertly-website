import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import type { ReactNode } from 'react';
export function ResourceHero({
  title,
  accent,
  children,
  search,
  aside,
}: {
  title: string;
  accent: string;
  children: ReactNode;
  search?: ReactNode;
  /** Optional decorative art on the right (desktop only); replaces the default rings. */
  aside?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-ink py-12 sm:py-16">
      {aside ?? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-0 hidden h-96 w-96 rounded-full border border-white/10 lg:block"
        >
          <div className="absolute inset-12 rounded-full border border-white/10" />
          <div className="absolute inset-24 rounded-full border border-white/10" />
        </div>
      )}
      <PageContainer className="relative">
        <Eyebrow dark>The GrowXQ advantage</Eyebrow>
        <h1 className="mt-4 max-w-4xl text-headline text-white">
          {title} <span className="text-accent">{accent}</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lede text-white/65">{children}</p>
        {search && <div className="mt-6 max-w-2xl">{search}</div>}
      </PageContainer>
    </section>
  );
}
