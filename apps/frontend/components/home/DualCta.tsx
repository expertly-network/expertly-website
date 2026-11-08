import { Button, Card, Eyebrow, SwipeRow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';

export function DualCta() {
  return (
    <section className="border-b border-line py-10 sm:py-24">
      <PageContainer>
        <Eyebrow>Two Ways In</Eyebrow>
        <h2 className="font-brand mt-4 text-section-title text-ink">
          One <span className="text-accent">platform</span>. Two powerful paths.
        </h2>
        <p className="mt-5 hidden max-w-2xl text-lede text-ink-3 sm:block">
          Whether you need the expertise or you are the expertise - GrowXQ is built to deliver real value, both ways.
        </p>
        {/* Phones: the two paths side by side as a swipeable row, the second card peeking in. */}
        <SwipeRow label="Two ways in" itemWidth="86%" className="mt-6 sm:mt-14 sm:gap-4 lg:grid-cols-2">
          {/* `!` because Card's own bg-bg-card is emitted later in the CSS and would win otherwise. */}
          <Card padding="xl" className="flex min-w-0 snap-start flex-col !bg-bg-alt max-sm:!p-6">
            <div className="text-mono-label text-ink-3">For Clients &amp; Businesses</div>
            <h3 className="font-brand mt-4 sm:mt-6 text-heading text-ink">
              Find the right <span className="text-accent">expert</span>. Fast.
            </h3>
            <ul className="mb-6 mt-4 flex flex-col gap-2.5 text-sm sm:mb-10 sm:mt-7 sm:gap-3.5 sm:text-[15px] text-ink-2">
              {[
                'Browse finance, tax & law professionals, vetted before listing',
                'Read expert articles on tax, law, M&A and compliance',
                'Request consultations from their profile, no middlemen',
                'Transparent rates upfront, before you commit',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button href="/members" className="mt-auto self-start">
              Browse members
            </Button>
          </Card>
          <Card padding="xl" className="relative flex min-w-0 snap-start flex-col overflow-hidden bg-ink max-sm:!p-6">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full"
              style={{
                background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
              }}
              aria-hidden="true"
            />
            <div className="relative flex flex-1 flex-col">
              <div className="text-mono-label text-white/60">For Finance, Tax &amp; Law Pros</div>
              <h3 className="font-brand mt-4 sm:mt-6 text-heading text-bg">
                Build your professional <span className="text-accent">presence</span>.
              </h3>
              <ul className="mb-6 mt-4 flex flex-col gap-2.5 text-sm sm:mb-10 sm:mt-7 sm:gap-3.5 sm:text-[15px] text-white/80">
                {[
                  'Get discovered by clients worldwide searching by expertise',
                  'Publish articles and establish your authority',
                  'Exclusive events and a verified peer network in 20+ jurisdictions',
                  'Set your rates and keep 100% of fees',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button href="/apply" variant="secondary-dark" className="mt-auto self-start">
                Apply now
              </Button>
            </div>
          </Card>
        </SwipeRow>
      </PageContainer>
    </section>
  );
}
