'use client';

import { useState } from 'react';
import { Card, Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';

// Marketing placeholder — not real testimonials.
const TESTIMONIALS = {
  members: [
    {
      quote:
        "Expertly gave me access to a calibre of clients I simply couldn't reach anywhere else. Every enquiry is from someone who genuinely values expert advice.",
      name: 'Priya Venkatesh',
      role: 'GST & Indirect Tax Director · Hyderabad',
      photo: 'https://randomuser.me/api/portraits/women/68.jpg',
    },
    {
      quote: 'My inbound consultation requests tripled within 60 days of going live. The right clients finally found me.',
      name: 'Marcus Chen',
      role: 'Senior Tax Advisor · Singapore',
      photo: 'https://randomuser.me/api/portraits/men/52.jpg',
    },
    {
      quote: "Publishing articles on Expertly built my professional brand faster than anything else I've tried.",
      name: 'Amara Osei',
      role: 'Corporate Counsel · Accra',
      photo: 'https://randomuser.me/api/portraits/women/90.jpg',
    },
    {
      quote: 'The network events alone justify the membership. Connections that would have taken years to build.',
      name: 'Fatima Al-Hassan',
      role: 'Compliance Director · Dubai',
      photo: 'https://randomuser.me/api/portraits/women/57.jpg',
    },
  ],
  clients: [
    {
      quote:
        'We replaced six months of RFPs with one afternoon on Expertly. Found the right M&A counsel in Chennai by Tuesday, signed by Friday.',
      name: 'Oliver Schmidt',
      role: 'Capital Markets Partner · Frankfurt',
      photo: 'https://randomuser.me/api/portraits/men/41.jpg',
    },
    {
      quote: 'The rate transparency alone is worth the membership. No surprises, no hourly creep, no mystery partners billing us.',
      name: 'Elena Volkova',
      role: 'IP & Technology Counsel · London',
      photo: 'https://randomuser.me/api/portraits/women/12.jpg',
    },
    {
      quote:
        "Finally, a network where 'verified' actually means something. Every expert we've engaged delivered on the first conversation.",
      name: 'Claire Dubois',
      role: 'Antitrust Counsel · Paris',
      photo: 'https://randomuser.me/api/portraits/women/20.jpg',
    },
  ],
} as const;

export function Testimonials() {
  const [tab, setTab] = useState<'members' | 'clients'>('members');
  const items = TESTIMONIALS[tab];

  return (
    <section className="relative overflow-hidden border-b border-line bg-ink py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[10%] -top-[20%] h-[500px] w-[500px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--accent) 10%, transparent) 0%, transparent 65%)',
        }}
      />
      <PageContainer className="relative">
        <Eyebrow>Voices</Eyebrow>
        <h2 className="mt-4 text-section-title text-bg-card">
          <span className="text-accent">Trusted</span> by professionals worldwide.
        </h2>

        <div className="mb-8 mt-8 inline-flex rounded-full border border-white/15 p-1" role="tablist">
          {(['members', 'clients'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? 'bg-bg-card text-ink' : 'text-white/60 hover:text-white'
              }`}
            >
              By {t}
            </button>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {items.map((t) => (
            <Card key={t.name} padding="lg" className="flex flex-col gap-7">
              <blockquote className="text-lede text-ink-2">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              {/* Anchors attribution to the bottom so every card's photo/name row lines up. */}
              <figcaption className="mt-auto flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.photo}
                  alt=""
                  className="h-10 w-10 flex-none rounded-full object-cover"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{t.name}</div>
                  <div className="truncate text-xs text-ink-3">{t.role}</div>
                </div>
              </figcaption>
            </Card>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}
