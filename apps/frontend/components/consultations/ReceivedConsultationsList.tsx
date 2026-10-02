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

// Prefixes a value that could be interpreted as a spreadsheet formula (CSV injection) with a
// leading apostrophe, which Excel/Google Sheets treat as "force this cell to plain text."
function csvEscape(value: string): string {
  const str = String(value);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return /["\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function downloadTranscript(requests: ConsultationRequestDto[]) {
  const headers = ['Requester', 'Type', 'Firm', 'Message', 'Email', 'Phone', 'Received', 'Status'];
  const rows = requests.map((r) => [
    r.requesterName,
    r.requesterIsVerifiedMember ? 'Member' : 'Client',
    r.requesterFirmName ?? '',
    r.message,
    r.requesterContactEmail,
    r.requesterPhone,
    new Date(r.createdAt).toLocaleDateString('en-US'),
    r.status,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expertly-consultation-transcript-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReceivedConsultationsList({
  initialRequests,
  viewerId,
}: {
  initialRequests: ConsultationRequestDto[];
  viewerId: string;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      completed: requests.filter((r) => r.status === 'completed').length,
      declined: requests.filter((r) => r.status === 'declined').length,
    }),
    [requests]
  );

  const filtered = useMemo(() => {
    let pool = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      pool = pool.filter(
        (r) => r.requesterName.toLowerCase().includes(q) || (r.requesterFirmName ?? '').toLowerCase().includes(q)
      );
    }
    return pool;
  }, [requests, filter, query]);

  function handleStatusChange(id: string, status: 'completed' | 'declined', responseMessage: string) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status, responseMessage } : r)));
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
        <div className="flex flex-1 items-center gap-3 max-[640px]:flex-col max-[640px]:items-stretch min-[640px]:flex-none min-[640px]:w-auto">
          <Input
            label=""
            aria-label="Search by name or firm…"
            placeholder="Search by name or firm…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full min-[640px]:w-64"
          />
          {requests.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => downloadTranscript(requests)}>
              Download transcript
            </Button>
          )}
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">No consultation requests yet.</p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">
          No requests match this view. Try a different status filter or clear the search.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((request) => (
            <ConsultationCard
              key={request.id}
              variant="received"
              request={request}
              viewerId={viewerId}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
