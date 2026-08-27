'use client';

import { useState } from 'react';

interface FaqEntry {
  q: string;
  a: string;
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
              className="flex w-full items-center justify-between gap-4 py-2 text-left text-title font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
