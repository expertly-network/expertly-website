'use client';

import { useState } from 'react';
import { Button, Card, Eyebrow, FilterPopover } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { REGIONS } from '@/components/apply/types';
import { countriesInRegions } from '@/lib/members/country-regions';

// No backend yet — submitting shows a "not live" message instead of faking success.
export function Newsletter() {
  const [submitted, setSubmitted] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  // Phones: the optional region/country preferences stay collapsed behind a text toggle.
  const [showPrefs, setShowPrefs] = useState(false);
  const prefCount = regions.length + countries.length;

  return (
    <section className="border-b border-line py-10 sm:py-24">
      <PageContainer>
        <Card
          padding="lg"
          // No overflow-hidden: the decoration is a CSS background (stays inside the rounded card
          // anyway), and clipping cut the region/country dropdowns off after ~3 options.
          className="relative bg-ink max-sm:!p-6 sm:px-12 sm:py-16 lg:px-16 lg:py-20"
          style={{
            backgroundImage:
              'radial-gradient(1200px 600px at 15% -10%, color-mix(in oklab, var(--accent) 20%, transparent) 0%, transparent 60%), repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 32px)',
          }}
        >
          {/* Heading on the left, the signup controls on the right (stacked on smaller screens). */}
          <div className="relative grid items-center gap-5 sm:gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="max-w-xl">
              <Eyebrow dark className="!text-white/80 sm:!text-[13px]">
                The GrowXQ Brief · Weekly
              </Eyebrow>
              <h2 className="font-brand mt-3 text-[26px] !leading-[1.1] text-bg-card sm:mt-5 sm:text-headline">
                <span className="text-accent">Regulatory</span> changes. New members. Case studies.
              </h2>
              <p className="mt-2 text-sm text-white/60 sm:font-brand sm:mt-0 sm:text-headline sm:!leading-[1.1]">
                One email, every Thursday.
              </p>
            </div>

            <div className="w-full max-w-[520px] lg:justify-self-end">
              <button
                type="button"
                aria-expanded={showPrefs}
                aria-controls="newsletter-prefs"
                onClick={() => setShowPrefs((v) => !v)}
                className="-my-2 mb-1 inline-flex min-h-11 items-center gap-1.5 text-sm text-white/70 hover:text-white sm:hidden"
              >
                {prefCount > 0 ? `Regions selected (${prefCount})` : 'Choose regions (optional)'}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`transition-transform ${showPrefs ? 'rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <div id="newsletter-prefs" className={`${showPrefs ? 'flex' : 'hidden'} flex-wrap gap-2.5 sm:flex`}>
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
                className="mt-3 flex flex-col gap-2.5 sm:mt-7 sm:flex-row"
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
                  className="w-full rounded-input border border-white/20 bg-white/10 px-4 py-3.5 text-base text-bg sm:py-4 placeholder:text-white/65"
                />
                <Button type="submit" variant="secondary-dark" className="min-h-[52px] !text-base sm:min-h-[56px]">
                  Subscribe
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
