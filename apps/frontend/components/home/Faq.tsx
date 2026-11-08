'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

interface FaqEntry {
  q: string;
  a: string;
}

export function HomeFaq({ membership, clients }: { membership: FaqEntry[]; clients: FaqEntry[] }) {
  const [audience, setAudience] = useState<'membership' | 'clients'>('membership');

  return (
    <div className="mt-8 sm:mt-10">
      <div className="mb-6 flex gap-2 sm:hidden" role="group" aria-label="Question topics">
        <Button
          variant={audience === 'membership' ? 'primary' : 'secondary'}
          className="min-h-11 flex-1 !px-3"
          aria-pressed={audience === 'membership'}
          onClick={() => setAudience('membership')}
        >
          Membership
        </Button>
        <Button
          variant={audience === 'clients' ? 'primary' : 'secondary'}
          className="min-h-11 flex-1 !px-3"
          aria-pressed={audience === 'clients'}
          onClick={() => setAudience('clients')}
        >
          For clients
        </Button>
      </div>
      <div className="grid gap-8 sm:gap-12 lg:grid-cols-2">
        <div className={audience === 'membership' ? '' : 'hidden sm:block'}>
          <FaqGroup title="Joining & membership" items={membership} />
        </div>
        <div className={audience === 'clients' ? '' : 'hidden sm:block'}>
          <FaqGroup title="For clients & users" items={clients} />
        </div>
      </div>
    </div>
  );
}

export function FaqGroup({ title, items }: { title: string; items: FaqEntry[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-mono-label text-accent">{title}</h3>
      {items.map((item, i) => {
        const open = openIndex === i;
        const panelId = `faq-panel-${title}-${i}`.replace(/\s+/g, '-');
        return (
          <div key={item.q} className="border-b border-line pb-3">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              className="flex w-full items-center justify-between gap-4 min-h-11 py-2 text-left text-base sm:text-title font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-expanded={open}
              aria-controls={panelId}
            >
              <span>{item.q}</span>
              <span aria-hidden="true" className="flex-none text-ink-3">
                {open ? '−' : '+'}
              </span>
            </button>
            {open && (
              <p id={panelId} className="mt-1 text-base leading-relaxed text-ink-3">
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
