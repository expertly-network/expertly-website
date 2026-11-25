import { Button, Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { VerticalsStackCards } from '@/components/home/VerticalsStack';
import type { Vertical } from '@/components/home/verticals-data';

// What a free user account gets, as the stacking cards. On large screens the heading and the button
// stay pinned on the left while the cards stack on the right; phones get the heading, then the stack.
export function UserBenefits({ benefits }: { benefits: readonly Vertical[] }) {
  return (
    <section aria-labelledby="users-title" className="bg-bg-alt py-12 sm:py-20">
      <PageContainer className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14">
        {/* Capped at the finished stack's height (five 58px bars + one 340px card), so both leave together. */}
        <div className="lg:sticky lg:top-6 lg:flex lg:h-[630px] lg:flex-col">
          <Eyebrow>For users · Free</Eyebrow>
          <h2 id="users-title" className="font-brand mt-3 text-heading text-ink">
            Looking for an expert? <span className="text-accent">Start here, free.</span>
          </h2>
          <p className="mt-4 max-w-md text-base text-ink-3 sm:text-lg">
            Anyone can search GrowXQ. A free account opens up contact details, full articles and event details.
          </p>
          <Button href="/members" className="mt-6 self-start">
            Find an expert
          </Button>
        </div>

        <VerticalsStackCards verticals={benefits} />
      </PageContainer>
    </section>
  );
}
