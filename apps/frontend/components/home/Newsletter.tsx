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
          className="relative overflow-hidden bg-ink"
          style={{
            backgroundImage:
              'radial-gradient(1200px 600px at 15% -10%, color-mix(in oklab, var(--accent) 20%, transparent) 0%, transparent 60%), repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 32px)',
          }}
        >
          <div className="relative max-w-xl">
            <Eyebrow dark>The Expertly Brief · Weekly</Eyebrow>
            <h2 className="mt-4 text-section-title text-bg-card">
              <span className="text-accent">Regulatory</span> changes. New members. Case studies.
            </h2>
            <p className="mt-1 text-section-title text-white/40">One email, every Thursday.</p>

            <div className="mt-6 flex flex-wrap gap-2.5">
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
              className="mt-8 flex max-w-[420px] flex-col gap-2 sm:flex-row"
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
                className="w-full rounded-input border border-white/20 bg-white/10 px-3.5 py-3 text-sm text-bg placeholder:text-white/40"
              />
              <Button type="submit" variant="secondary-dark">
                Subscribe
              </Button>
            </form>
            {submitted && (
              <p className="mt-3 text-xs text-white/60" role="status">
                Newsletter subscriptions aren&apos;t live yet — check back soon.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/50">
              <span>✓ No spam</span>
              <span>✓ Unsubscribe anytime</span>
              <span>✓ 4,200+ professional readers</span>
            </div>
          </div>
        </Card>
      </PageContainer>
    </section>
  );
}
