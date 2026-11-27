import { Button, Card } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';

// On larger screens, two lanes sit below the hero so each visitor sees which path is theirs.
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

// Both buttons follow the viewer, chosen by the page from the session. User card: logged-out
// visitors sign in, anyone signed in finds an expert. Member card: visitors and clients apply,
// members open their profile, admins go to the admin panel.
export type GrowthCta = { href: string; label: string };

export function DualCta({ userCta, growthCta }: { userCta: GrowthCta; growthCta: GrowthCta }) {
  return (
    <section
      aria-label="Two ways to use GrowXQ"
      className="hidden border-b border-line bg-[linear-gradient(to_bottom,var(--ink)_6rem,transparent_6rem)] pb-16 sm:block"
    >
      <PageContainer className="grid grid-cols-2 gap-8 lg:gap-12">
        {/* `!` because Card's own bg-bg-card is emitted later in the CSS and would win otherwise. */}
        <Card padding="md" className="flex min-w-0 flex-col gap-3 !bg-bg-alt shadow-xl sm:gap-3.5 sm:!p-8">
          <div className="text-mono-label text-ink-3">Users · Free</div>
          <h2 className="font-brand text-heading text-ink">In search of an expert</h2>
          <p className="max-w-[30em] text-base text-ink-2">
            Search verified finance, tax and legal professionals, connect for direct consultations, read their articles
            or adopt the skills they have.
          </p>
          <div className="mt-auto flex justify-end pt-1">
            <Button href={userCta.href}>
              {userCta.label} <Arrow />
            </Button>
          </div>
        </Card>

        <Card padding="md" className="flex min-w-0 flex-col gap-3 !border-white/10 bg-ink shadow-xl sm:gap-3.5 sm:!p-8">
          <div className="text-mono-label text-accent">Members · Verified · Subscription based</div>
          <h2 className="font-brand text-heading text-bg">Seeking growth as a professional</h2>
          <p className="max-w-[30em] text-base text-white/75">
            Get verified, get visible to your target audience and use the full growth ecosystem.
          </p>
          <div className="mt-auto flex justify-end pt-1">
            <Button href={growthCta.href} variant="accent">
              {growthCta.label} <Arrow />
            </Button>
          </div>
        </Card>
      </PageContainer>
    </section>
  );
}
