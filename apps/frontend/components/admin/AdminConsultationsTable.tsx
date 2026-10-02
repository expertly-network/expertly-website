'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Input } from '@/components/ui';
import type { ConsultationRequestDto, ConsultationStatus } from '@shared/consultation-request';

type Filter = 'all' | ConsultationStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'declined', label: 'Declined' },
];

const STATUS_BADGE_VARIANT: Record<ConsultationStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  completed: 'success',
  declined: 'danger',
};

const STATUS_LABEL: Record<ConsultationStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  declined: 'Declined',
};

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

// Admin oversight, deliberately minimal — who requested what, to which member, and its status.
// No contact info, no message body, no conversation, no actions: the member is the one who owns
// the decision on their own requests; this is visibility only, not a management surface.
export function AdminConsultationsTable({ initialRequests }: { initialRequests: ConsultationRequestDto[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let pool = filter === 'all' ? initialRequests : initialRequests.filter((r) => r.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      pool = pool.filter(
        (r) =>
          r.requesterName.toLowerCase().includes(q) ||
          (r.memberName ?? '').toLowerCase().includes(q)
      );
    }
    return pool;
  }, [initialRequests, filter, query]);

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
        <Input
          label=""
          aria-label="Search by requester or member…"
          placeholder="Search by requester or member…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full min-[640px]:w-72"
        />
      </div>

      {initialRequests.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">No consultation requests yet.</p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">
          No requests match this view. Try a different status filter or clear the search.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-line bg-bg-alt text-left text-xs font-medium text-ink-3">
                <th className="px-6 py-3">Requester</th>
                <th className="px-6 py-3">Requested</th>
                <th className="px-6 py-3">Member</th>
                <th className="px-6 py-3">Sent</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-b-0">
                  <td className="px-6 py-4">
                    <span className="font-medium text-ink">{r.requesterName}</span>
                    {r.requesterIsVerifiedMember && (
                      <span className="ml-1.5 text-xs text-ink-3">(member)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-ink-2">
                    {r.serviceName ?? r.customServiceLabel ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {r.memberSlug ? (
                      <Link href={`/members/${r.memberSlug}`} className="font-medium text-ink hover:text-accent">
                        {r.memberName ?? 'Member'}
                      </Link>
                    ) : (
                      <span className="text-ink-2">{r.memberName ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-ink-3">
                    {DATE_FORMAT.format(new Date(r.createdAt)).toUpperCase()}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={STATUS_BADGE_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
