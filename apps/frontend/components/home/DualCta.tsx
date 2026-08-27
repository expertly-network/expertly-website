import { Button, Card, Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';

// "Two Ways In" — copy verbatim from design/static_html/index.html, fully static.
export function DualCta() {
  return (
    <section className="border-b border-line py-24">
      <PageContainer>
        <Eyebrow>Two Ways In</Eyebrow>
        <h2 className="mt-4 text-section-title text-ink">
          One <span className="text-accent">platform</span>. Two powerful paths.
        </h2>
        <p className="mt-5 max-w-2xl text-lede text-ink-3">
          Whether you need the expertise or you are the expertise - Expertly is built to deliver
          real value, both ways.
        </p>
        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          <Card padding="xl">
            <div className="text-mono-label text-ink-3">For Clients &amp; Businesses</div>
            <h3 className="mt-6 text-heading text-ink">
              Find the right <span className="text-accent">expert</span>. Fast.
            </h3>
            <ul className="mt-7 flex flex-col gap-3.5 text-[15px] text-ink-2">
              {[
                'Browse verified finance & legal professionals',
                'Read expert articles on tax, law, M&A, compliance',
                'Request consultations directly, no middlemen',
                'Transparent rates upfront before you commit',
                'Verified credentials, rigorously vetted before listing',
                'Book directly from their profile, no delays',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button href="/members" className="mt-10">
              Browse members
            </Button>
          </Card>
          <Card padding="xl" className="relative overflow-hidden bg-ink">
            {/* Matches design's `.dual-card-dark::before` — soft accent-tinted circle bleeding
                off the top-right corner, same technique as the other dark cards on this page. */}
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full"
              style={{
                background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
              }}
              aria-hidden="true"
            />
            <div className="relative">
              <div className="text-mono-label text-white/60">For Finance &amp; Legal Pros</div>
              <h3 className="mt-6 text-heading text-bg">
                Build your professional <span className="text-neon">presence</span>.
              </h3>
              <ul className="mt-7 flex flex-col gap-3.5 text-[15px] text-white/80">
                {[
                  'Get discovered by clients globally',
                  'Publish articles, establish authority',
                  'Exclusive events with verified peers',
                  'Set your rates, keep 100% of fees',
                  'Connect with a verified peer network across 20+ jurisdictions',
                  'Global discovery, found by clients searching by expertise',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button href="/apply" variant="secondary-dark" className="mt-10">
                Apply for membership
              </Button>
            </div>
          </Card>
        </div>
      </PageContainer>
    </section>
  );
}
