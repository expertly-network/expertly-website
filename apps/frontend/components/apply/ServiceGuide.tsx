'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { serviceGuideLines } from '@/lib/apply/service-guide';
import type { CategoryDto } from '@shared/category';

// The "?" beside the service preferences: the whole taxonomy in one place, as a three-column table —
// service line (shown as Category) → category (Subcategory) → services — searchable, so an applicant
// can see where a service sits before ranking it.
export function ServiceGuide({ categories }: { categories: CategoryDto[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sortedLines = serviceGuideLines(categories, query);

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
      <Modal open={open} onClose={() => setOpen(false)} title="How services are organised" size="xl">
        <p className="text-sm text-ink-3">
          Services are organised in three levels: the <strong className="font-semibold text-ink">category</strong> is
          the broad area, the <strong className="font-semibold text-ink">subcategory</strong> is the practice within it,
          and the <strong className="font-semibold text-ink">service</strong> is the specific issue you solve. Your
          preferences are services.
        </p>
        <div className="mt-4">
          <Input
            label="Search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories, subcategories or services"
          />
        </div>
        {sortedLines.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-3">
            {categories.length ? 'Nothing matches — try a shorter search.' : 'Services are temporarily unavailable.'}
          </p>
        ) : (
          // Below sm the Category column folds into a full-width row above its subcategories, so the
          // services column keeps enough width at 375px.
          <div className="mt-5 overflow-hidden rounded-card border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-bg-alt text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                <tr>
                  <th scope="col" className="w-[22%] border-r border-line px-4 py-2.5 max-sm:hidden">
                    Category
                  </th>
                  <th scope="col" className="w-[24%] border-r border-line px-4 py-2.5 max-sm:w-[38%] max-sm:px-3">
                    Subcategory
                  </th>
                  <th scope="col" className="px-4 py-2.5 max-sm:px-3">
                    Services
                  </th>
                </tr>
              </thead>
              {sortedLines.map((line) => (
                <tbody key={line.id} className="border-t border-line">
                  <tr className="sm:hidden">
                    <th scope="colgroup" colSpan={2} className="bg-bg-alt/60 px-3 py-2 font-semibold text-ink">
                      {line.name}
                    </th>
                  </tr>
                  {line.solutions.map((s, i) => (
                    <tr key={s.id} className={i > 0 ? 'border-t border-line' : 'max-sm:border-t max-sm:border-line'}>
                      {i === 0 && (
                        <th
                          scope="rowgroup"
                          rowSpan={line.solutions.length}
                          className="border-r border-line px-4 py-3 align-top font-semibold text-ink max-sm:hidden"
                        >
                          {line.name}
                        </th>
                      )}
                      <td className="border-r border-line px-4 py-3 align-top font-medium text-ink-2 max-sm:px-3">
                        {s.name}
                      </td>
                      <td className="px-4 py-3 align-top max-sm:px-3">
                        {s.problems.length > 0 ? (
                          <ul className="flex flex-wrap gap-1.5" aria-label={`Services under ${s.name}`}>
                            {s.problems.map((p) => (
                              <li key={p} className="rounded-full bg-bg-alt px-2.5 py-1 text-xs text-ink-2">
                                {p}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-ink-4">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
