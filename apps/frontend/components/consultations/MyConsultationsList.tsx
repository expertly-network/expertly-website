'use client';

import { useMemo, useState } from 'react';
import { Input, Button } from '@/components/ui';
import { ConsultationCard } from '@/components/consultations/ConsultationCard';
import { ConsultationStats } from '@/components/consultations/ConsultationStats';
import type { ConsultationRequestDto, ConsultationStatus } from '@shared/consultation-request';

type Filter = 'all' | ConsultationStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'declined', label: 'Declined' },
];

export function MyConsultationsList({
  initialRequests,
  viewerId,
}: {
  initialRequests: ConsultationRequestDto[];
  viewerId: string;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => ({
      total: initialRequests.length,
      pending: initialRequests.filter((r) => r.status === 'pending').length,
      completed: initialRequests.filter((r) => r.status === 'completed').length,
      declined: initialRequests.filter((r) => r.status === 'declined').length,
    }),
    [initialRequests]
  );

  const filtered = useMemo(() => {
    let pool = filter === 'all' ? initialRequests : initialRequests.filter((r) => r.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      pool = pool.filter(
        (r) => (r.memberName ?? '').toLowerCase().includes(q) || (r.memberFirmName ?? '').toLowerCase().includes(q)
      );
    }
    return pool;
  }, [initialRequests, filter, query]);

  if (initialRequests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-ink-3">You haven&apos;t requested a consultation yet.</p>
        <Button href="/members">Browse Members</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ConsultationStats {...counts} />

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
        <Input
          label=""
          aria-label="Search by member or firm…"
          placeholder="Search by member or firm…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full min-[640px]:w-64"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">
          No requests match this view. Try a different status filter or clear the search.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((request) => (
            <ConsultationCard key={request.id} variant="mine" request={request} viewerId={viewerId} />
          ))}
        </div>
      )}
    </div>
  );
}
