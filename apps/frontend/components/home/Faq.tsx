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
        return (
          <div key={item.q} className="border-b border-line pb-3">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              className="flex w-full items-center justify-between gap-4 py-2 text-left text-sm font-medium text-ink"
              aria-expanded={open}
            >
              <span>{item.q}</span>
              <span aria-hidden="true" className="flex-none text-ink-3">
                {open ? '−' : '+'}
              </span>
            </button>
            {open && <p className="mt-1 text-sm leading-relaxed text-ink-3">{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}
