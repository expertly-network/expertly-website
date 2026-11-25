import { Button, Card } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';

// Right under the hero: two compact "lanes" so each visitor sees which path is theirs before the
// long sections start. The cards sit on the hero's lower edge (a short ink band at the top of this
// section continues the hero's background). Copy follows the GrowXQ_Homepage_Redesign sample.
function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 flex-none"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function DualCta() {
  return (
    <section
      aria-label="Two ways to use GrowXQ"
      className="border-b border-line bg-[linear-gradient(to_bottom,var(--ink)_4rem,transparent_4rem)] pb-10 sm:bg-[linear-gradient(to_bottom,var(--ink)_6rem,transparent_6rem)] sm:pb-16"
    >
      <PageContainer className="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:gap-12">
        {/* `!` because Card's own bg-bg-card is emitted later in the CSS and would win otherwise. */}
        <Card padding="md" className="flex min-w-0 flex-col gap-3 !bg-bg-alt shadow-xl sm:gap-3.5 sm:!p-8">
          <div className="text-mono-label text-ink-3">Users · Free</div>
          <h2 className="font-brand text-heading text-ink">I need an expert</h2>
          <p className="max-w-[30em] text-base text-ink-2">
            Any field, any role, any level. Go straight to a verified expert, filtered to what you need.
          </p>
          <div className="mt-auto flex justify-end pt-1">
            <Button href="/members">
              Find an expert <Arrow />
            </Button>
          </div>
        </Card>

        <Card padding="md" className="flex min-w-0 flex-col gap-3 !border-white/10 bg-ink shadow-xl sm:gap-3.5 sm:!p-8">
          <div className="text-mono-label text-accent">Members · Verified</div>
          <h2 className="font-brand text-heading text-bg">I&apos;m a senior professional</h2>
          <p className="max-w-[30em] text-base text-white/75">
            Finance, tax or legal. Get verified, get seen by the people looking for you, and grow with everything GrowXQ
            gives you.
          </p>
          <div className="mt-auto flex justify-end pt-1">
            <Button href="/apply" variant="accent">
              Apply as a member <Arrow />
            </Button>
          </div>
        </Card>
      </PageContainer>
    </section>
  );
}
