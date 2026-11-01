'use client';

import { useState } from 'react';
import { Button, Card, Eyebrow, FilterPopover } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { REGIONS } from '@/components/apply/types';
import { ALL_COUNTRIES } from '@/lib/members/countries';

// No backend yet — submitting shows a "not live" message instead of faking success.
export function Newsletter() {
  const [submitted, setSubmitted] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  return (
    <section className="border-b border-line py-24">
      <PageContainer>
        <Card
          padding="lg"
          // No overflow-hidden: the decoration is a CSS background (stays inside the rounded card
          // anyway), and clipping cut the region/country dropdowns off after ~3 options.
          className="relative bg-ink sm:px-12 sm:py-16 lg:px-16 lg:py-20"
          style={{
            backgroundImage:
              'radial-gradient(1200px 600px at 15% -10%, color-mix(in oklab, var(--accent) 20%, transparent) 0%, transparent 60%), repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 32px)',
          }}
        >
          {/* Heading on the left, the signup controls on the right (stacked on smaller screens). */}
          <div className="relative grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="max-w-xl">
              <Eyebrow dark className="!text-[13px] !text-white/80">
                The GrowXQ Brief · Weekly
              </Eyebrow>
              <h2 className="font-brand mt-5 text-headline !leading-[1.1] text-bg-card">
                <span className="text-accent">Regulatory</span> changes. New members. Case studies.
              </h2>
              <p className="font-brand text-headline !leading-[1.1] text-white/60">One email, every Thursday.</p>
            </div>

            <div className="w-full max-w-[520px] lg:justify-self-end">
              <div className="flex flex-wrap gap-2.5">
                <FilterPopover
                  label="All regions"
                  options={REGIONS.map((r) => ({ value: r.value, label: r.label }))}
                  selected={regions}
                  onChange={setRegions}
                />
                <FilterPopover
                  label="All countries"
                  options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
                  selected={countries}
                  onChange={setCountries}
                />
              </div>

              <form
                className="mt-7 flex flex-col gap-2.5 sm:flex-row"
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
                  className="w-full rounded-input border border-white/20 bg-white/10 px-4 py-4 text-base text-bg placeholder:text-white/65"
                />
                <Button type="submit" variant="secondary-dark" className="min-h-[56px] !text-base">
                  Subscribe
                </Button>
              </form>
              {submitted && (
                <p className="mt-3 text-xs text-white/60" role="status">
                  Newsletter subscriptions aren&apos;t live yet — check back soon.
                </p>
              )}

              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-white/70">
                <span>✓ No spam</span>
                <span>✓ Unsubscribe anytime</span>
                <span>✓ 4,200+ professional readers</span>
              </div>
            </div>
          </div>
        </Card>
      </PageContainer>
    </section>
  );
}
