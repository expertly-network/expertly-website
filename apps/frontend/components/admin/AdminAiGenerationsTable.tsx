'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui';
import { AiGenerationStatusBadge } from '@/components/admin/AiGenerationStatusBadge';
import type { AdminAiGenerationListItemDto, AiGenerationStatus } from '@shared/article';

type Filter = 'all' | 'saved' | AiGenerationStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'saved', label: 'Saved as article' },
  { key: 'success', label: 'Generated' },
  { key: 'failed', label: 'Failed' },
];

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
const TIME_FORMAT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

function matchesFilter(g: AdminAiGenerationListItemDto, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'saved') return g.article !== null;
  return g.status === filter;
}

// Read-only log of every AI article-draft attempt. Filtering/search is client-side over the
// (capped) list, same approach as AdminConsultationsTable. Each row opens the full
// inputs-vs-output detail page.
export function AdminAiGenerationsTable({ generations }: { generations: AdminAiGenerationListItemDto[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let pool = generations.filter((g) => matchesFilter(g, filter));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      pool = pool.filter(
        (g) =>
          g.authorName.toLowerCase().includes(q) ||
          (g.draftTitle ?? '').toLowerCase().includes(q) ||
          (g.article?.title ?? '').toLowerCase().includes(q)
      );
    }
    return pool;
  }, [generations, filter, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors ${
                filter === f.key ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:border-ink-3'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="w-full min-[640px]:w-72">
          <Input
            label=""
            aria-label="Search by member or title…"
            placeholder="Search by member or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {generations.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">
          No AI drafts generated yet. Every attempt from the &ldquo;Write with AI&rdquo; wizard shows up here.
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">
          No generations match this view. Try a different filter or clear the search.
        </p>
      ) : (
        <>
          {/* ≥768px: table. Below that, the same rows as stacked cards — a 5-column table
              doesn't fit a 375px screen without hiding what matters. */}
          <div className="overflow-x-auto rounded-card border border-line max-[767px]:hidden">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-bg-alt text-left text-xs font-medium text-ink-3">
                  <th className="px-6 py-3">Draft</th>
                  <th className="px-6 py-3">Saved as</th>
                  <th className="px-6 py-3">Model</th>
                  <th className="px-6 py-3">Generated</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-b border-line align-top transition-colors last:border-b-0 hover:bg-bg-alt/60">
                    <td className="px-6 py-4">
                      <Link href={`/admin/ai-generations/${g.id}`} className="font-medium text-ink hover:text-accent">
                        {g.draftTitle ?? 'Generation failed'}
                      </Link>
                      <div className="mt-1 text-xs text-ink-3">by {g.authorName}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {g.article ? (
                        <Link href={`/articles/${g.article.id}`} className="text-ink-2 hover:text-accent">
                          {g.article.title}
                        </Link>
                      ) : (
                        <span className="text-ink-3">Not saved</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-ink-3">{g.model ?? '—'}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs text-ink-3">
                      {DATE_FORMAT.format(new Date(g.createdAt)).toUpperCase()}
                      <div className="mt-0.5">{TIME_FORMAT.format(new Date(g.createdAt))}</div>
                    </td>
                    <td className="px-6 py-4">
                      <AiGenerationStatusBadge status={g.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 min-[768px]:hidden">
            {filtered.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/admin/ai-generations/${g.id}`}
                  className="block rounded-card border border-line bg-bg-card p-4 transition-colors hover:border-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-ink">{g.draftTitle ?? 'Generation failed'}</span>
                    <AiGenerationStatusBadge status={g.status} />
                  </div>
                  <div className="mt-1 text-xs text-ink-3">by {g.authorName}</div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                    <span>{DATE_FORMAT.format(new Date(g.createdAt)).toUpperCase()}</span>
                    <span>{g.article ? 'Saved as article' : 'Not saved'}</span>
                    {g.model && <span className="font-mono">{g.model}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
