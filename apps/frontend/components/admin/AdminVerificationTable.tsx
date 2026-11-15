'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge, Input } from '@/components/ui';
import type { AdminMemberVerificationSummaryDto } from '@shared/member-verification';

type Tab = 'review' | 'badge';

// Anything still pending goes under "To review"; a member whose entries are all checked and who
// only needs the profile badge goes under "Ready for badge".
function tabOf(m: AdminMemberVerificationSummaryDto): Tab {
  return m.needsReview > 0 ? 'review' : 'badge';
}

const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: 'review', label: 'To review', empty: 'Nothing waiting for your decision.' },
  { key: 'badge', label: 'Ready for badge', empty: 'No member is ready for the GrowXQ Verified badge.' },
];

export function AdminVerificationTable({ members }: { members: AdminMemberVerificationSummaryDto[] }) {
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { review: 0, badge: 0 };
    for (const m of members) c[tabOf(m)] += 1;
    return c;
  }, [members]);
  const [tab, setTab] = useState<Tab>(() => (counts.review ? 'review' : 'badge'));
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => tabOf(m) === tab && (!q || m.name.toLowerCase().includes(q)));
  }, [members, tab, query]);

  if (members.length === 0) {
    return (
      <p className="rounded-panel border border-line bg-bg-alt p-6 text-sm text-ink-3">
        Nothing to verify right now — every entry on every profile is verified and every profile has its badge.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div role="tablist" className="flex gap-1 rounded-input bg-bg-alt p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {t.label} <span className="ml-1 tabular-nums text-ink-4">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="w-full max-w-xs">
          <Input label="Find a member" placeholder="Name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-panel border border-line bg-bg-alt p-6 text-sm text-ink-3">
          {query ? `No member matches “${query}” here.` : TABS.find((t) => t.key === tab)?.empty}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-bg-card">
          {visible.map((m) => (
            <li key={m.memberId}>
              <Link
                href={`/admin/member-verification/${m.memberId}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-bg-alt"
              >
                <span className="min-w-0 font-semibold text-ink">{m.name}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {m.needsReview > 0 && <Badge variant="warning">{m.needsReview} to review</Badge>}
                  {m.readyForBadge && <Badge variant="success">All verified — give badge</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
