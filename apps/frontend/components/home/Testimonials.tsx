'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { SEED_TESTIMONIALS, findMember } from '@/lib/design-seed-data';

// Ported from home.js's initTestimonials (tab-switched grid, real quotes tied to real
// members via id lookup).
export function Testimonials() {
  const [tab, setTab] = useState<'members' | 'clients'>('members');
  const items = SEED_TESTIMONIALS[tab];

  return (
    <div>
      <div className="mb-8 inline-flex rounded-full border border-line p-1">
        {(['members', 'clients'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-ink text-bg' : 'text-ink-3 hover:text-ink'
            }`}
          >
            By {t === 'members' ? 'members' : 'clients'}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((t) => {
          const member = findMember(t.who);
          if (!member) return null;
          return (
            <Card key={t.who} padding="md" className="flex flex-col">
              <blockquote className="flex-1 text-sm leading-relaxed text-ink-2">&ldquo;{t.q}&rdquo;</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={member.img} alt="" className="h-11 w-11 rounded-full object-cover" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{member.name}</div>
                  <div className="truncate font-mono text-[11px] text-ink-3">
                    {member.title} · {member.location.split(',')[0]}
                  </div>
                </div>
              </figcaption>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
