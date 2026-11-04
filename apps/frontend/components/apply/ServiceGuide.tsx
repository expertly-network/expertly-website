'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { CategoryDto } from '@shared/category';

// The "?" beside the service preferences: the whole taxonomy in one place — service line
// (shown as Category) → category (Solution) → service (Problem) — searchable, so an applicant
// can see where a service sits before ranking it.
export function ServiceGuide({ categories }: { categories: CategoryDto[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const lines = new Map<string, { name: string; solutions: { id: string; name: string; problems: string[] }[] }>();
  for (const c of categories) {
    const matchesSolution = !q || c.name.toLowerCase().includes(q) || c.serviceLineName.toLowerCase().includes(q);
    const problems = c.services.map((s) => s.name).filter((name) => matchesSolution || name.toLowerCase().includes(q));
    if (!problems.length && !matchesSolution) continue;
    const line = lines.get(c.serviceLineId) ?? { name: c.serviceLineName, solutions: [] };
    line.solutions.push({ id: c.id, name: c.name, problems });
    lines.set(c.serviceLineId, line);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How services are organised"
        title="How services are organised"
        className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-line-2 text-[11px] font-semibold text-ink-3 transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        ?
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="How services are organised" size="lg">
        <p className="text-sm text-ink-3">
          Services are organised in three levels: the <strong className="font-semibold text-ink">category</strong> is
          the broad area, the <strong className="font-semibold text-ink">solution</strong> is the practice within it,
          and the <strong className="font-semibold text-ink">problem</strong> is the specific issue you solve. Your
          preferences are problems.
        </p>
        <div className="mt-4">
          <Input
            label="Search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories, solutions or problems"
          />
        </div>
        {lines.size === 0 ? (
          <p className="py-8 text-center text-sm text-ink-3">
            {categories.length ? 'Nothing matches — try a shorter search.' : 'Services are temporarily unavailable.'}
          </p>
        ) : (
          <div className="mt-5 space-y-6">
            {[...lines.entries()].map(([id, line]) => (
              <section key={id}>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-bg">
                    Category
                  </span>
                  {line.name}
                </h3>
                <div className="mt-3 space-y-3 border-l border-line pl-4">
                  {line.solutions.map((s) => (
                    <div key={s.id}>
                      <p className="text-sm font-medium text-ink-2">
                        <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4">
                          Solution
                        </span>
                        {s.name}
                      </p>
                      {s.problems.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Problems under ${s.name}`}>
                          {s.problems.map((p) => (
                            <li key={p} className="rounded-full bg-bg-alt px-2.5 py-1 text-xs text-ink-2">
                              {p}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
