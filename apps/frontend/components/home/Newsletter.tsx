'use client';

import { useState } from 'react';
import { Button, Card, FilterPopover } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { REGIONS } from '@/components/apply/types';
import { countriesInRegions } from '@/lib/members/country-regions';

// No backend yet — submitting shows a "not live" message instead of faking success.
export function Newsletter() {
  const [submitted, setSubmitted] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  // Phones: the optional region/country preferences stay collapsed behind a text toggle.

  return (
    <section id="newsletter" className="scroll-mt-20 pb-16 pt-10 sm:pb-28 sm:pt-24">
      <PageContainer>
        <Card
          padding="lg"
          // No overflow-hidden: the decoration is a CSS background (stays inside the rounded card
          // anyway), and clipping cut the region/country dropdowns off after ~3 options.
          // Phones: edge to edge (no page gutter, square corners, no border), a full-width dark band.
          className="relative bg-ink max-sm:-mx-5 max-sm:!rounded-none max-sm:!border-0 max-sm:!px-5 max-sm:!py-8 sm:px-12 sm:py-16 lg:px-16 lg:py-20"
          style={{
            backgroundImage:
              'radial-gradient(1200px 600px at 15% -10%, color-mix(in oklab, var(--accent) 20%, transparent) 0%, transparent 60%), repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 32px)',
          }}
        >
          {/* Heading on the left, the signup controls on the right (stacked on smaller screens). */}
          <div className="relative grid items-center gap-5 sm:gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="max-w-xl">
              {/* Phones: one phrase per line, a short list rather than a wrapped sentence. */}
              <h2 className="font-brand text-[clamp(26px,8.5vw,34px)] !leading-[1.08] text-bg-card sm:text-headline">
                <span className="block sm:inline">
                  <span className="text-accent">Regulatory</span> changes.
                </span>{' '}
                <span className="block sm:inline">New members.</span>{' '}
                <span className="block sm:inline">Case studies.</span>
              </h2>
              <p className="mt-3 text-base text-white/70 sm:font-brand sm:mt-0 sm:text-headline sm:!leading-[1.1] sm:text-white/60">
                One email, every Thursday.
              </p>
            </div>

            {/* The region/country pickers (default: all), then email + Subscribe, then the reassurance line. */}
            <div className="w-full max-w-[520px] lg:justify-self-end">
              <div id="newsletter-prefs" className="flex flex-wrap gap-2.5">
                <FilterPopover
                  label="All regions"
                  options={REGIONS.map((r) => ({ value: r.value, label: r.label }))}
                  selected={regions}
                  onChange={(next) => {
                    setRegions(next);
                    // Drop any picked country that's no longer in the chosen regions.
                    const allowed = new Set(countriesInRegions(next));
                    setCountries((prev) => prev.filter((c) => allowed.has(c)));
                  }}
                />
                <FilterPopover
                  label="All countries"
                  // Narrowed to the selected regions (every country when none is selected).
                  options={countriesInRegions(regions).map((c) => ({ value: c, label: c }))}
                  selected={countries}
                  onChange={setCountries}
                />
              </div>

              <form
                // Phones: one row, the email field ~85% and an arrow button ~15%.
                className="mt-3 flex gap-2.5 sm:mt-7"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
              >
                <label htmlFor="newsletter-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  placeholder="you@firm.com"
                  required
                  className="min-w-0 flex-1 rounded-input border border-white/20 bg-white/10 px-4 py-3.5 text-base text-bg sm:py-4 placeholder:text-white/65"
                />
                <Button
                  type="submit"
                  variant="secondary-dark"
                  aria-label="Subscribe"
                  className="min-h-[52px] !text-base max-sm:w-[15%] max-sm:min-w-12 max-sm:flex-none max-sm:!px-0 sm:min-h-[56px]"
                >
                  <span className="hidden sm:inline">Subscribe</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="size-5 sm:hidden"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Button>
              </form>
              {submitted && (
                <p className="mt-3 text-xs text-white/60" role="status">
                  Newsletter subscriptions aren&apos;t live yet — check back soon.
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-caption text-white/55 sm:mt-7 sm:gap-x-6 sm:text-[15px] sm:text-white/70">
                <span>✓ No spam</span>
                <span>✓ Unsubscribe anytime</span>
                {/* Unconfirmed figure (see docs/homepage-responsive-audit.md); kept off phones. */}
                <span className="hidden sm:inline">✓ 4,200+ professional readers</span>
              </div>
            </div>
          </div>
        </Card>
      </PageContainer>
    </section>
  );
}
