'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Input, Select } from '@/components/ui';
import { SECTION_TITLES } from '@/components/members/edit/sectionFieldConfig';
import type { MemberEditSection, MemberProfileEditDto } from '@shared/member';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

type QueueFilter = 'pending' | 'reviewed' | 'all';

interface MemberRow {
  memberId: string;
  name: string;
  photoUrl: string | null;
  pendingSections: MemberEditSection[];
  pendingCount: number;
  /** Oldest still-pending submission — how long this member has been waiting. */
  waitingSince: string | null;
  lastActivity: string;
}

// One row per member (the prototype's panel is one row per edit; grouping by member lets an admin
// review everything a person changed in one sitting — see docs/rest-api.md).
function groupByMember(edits: MemberProfileEditDto[]): MemberRow[] {
  const byMember = new Map<string, MemberRow>();
  for (const edit of edits) {
    let row = byMember.get(edit.memberId);
    if (!row) {
      row = {
        memberId: edit.memberId,
        name: edit.memberName,
        photoUrl: edit.memberPhotoUrl,
        pendingSections: [],
        pendingCount: 0,
        waitingSince: null,
        lastActivity: edit.reviewedAt ?? edit.submittedAt,
      };
      byMember.set(edit.memberId, row);
    }
    const activity = edit.reviewedAt ?? edit.submittedAt;
    if (activity > row.lastActivity) row.lastActivity = activity;
    if (edit.status === 'pending') {
      row.pendingCount += 1;
      if (!row.pendingSections.includes(edit.section)) row.pendingSections.push(edit.section);
      if (!row.waitingSince || edit.submittedAt < row.waitingSince) row.waitingSince = edit.submittedAt;
    }
  }
  return [...byMember.values()];
}

function MemberAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt="" className="h-9 w-9 flex-none rounded-full object-cover" />
  ) : (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-bg-alt text-xs font-semibold text-ink-2">
      {initials}
    </span>
  );
}

function SectionChips({ sections }: { sections: MemberEditSection[] }) {
  if (sections.length === 0) return <span className="text-sm text-ink-3">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {sections.map((s) => (
        <Badge key={s} variant="neutral">
          {SECTION_TITLES[s]}
        </Badge>
      ))}
    </div>
  );
}

function StatusCell({ row }: { row: MemberRow }) {
  return row.pendingCount > 0 ? (
    <Badge variant="warning">
      {row.pendingCount} pending
    </Badge>
  ) : (
    <Badge variant="success">Reviewed</Badge>
  );
}

export function AdminMemberEditsTable({ edits }: { edits: MemberProfileEditDto[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<QueueFilter>('pending');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groupByMember(edits)
      .filter((row) => {
        if (filter === 'pending' && row.pendingCount === 0) return false;
        if (filter === 'reviewed' && row.pendingCount > 0) return false;
        return q.length === 0 || row.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // Oldest waiting first (a fair queue); fully reviewed members by most recent activity.
        if (a.waitingSince && b.waitingSince) return a.waitingSince.localeCompare(b.waitingSince);
        if (a.waitingSince) return -1;
        if (b.waitingSince) return 1;
        return b.lastActivity.localeCompare(a.lastActivity);
      });
  }, [edits, query, filter]);

  if (edits.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-3">No profile edits have been submitted yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Input label="Search by name" placeholder="Member name…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="w-full max-w-[220px]">
          <Select label="Show" value={filter} onChange={(e) => setFilter(e.target.value as QueueFilter)}>
            <option value="pending">Needs review</option>
            <option value="reviewed">Fully reviewed</option>
            <option value="all">All members</option>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">
          {filter === 'pending' && query === '' ? 'All caught up — nothing left to review.' : 'No members match this filter.'}
        </p>
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="overflow-x-auto rounded-card border border-line max-[767px]:hidden">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-bg-alt text-left text-xs font-medium text-ink-3">
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Sections changed</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Waiting since</th>
                  <th className="px-6 py-3">Last activity</th>
                  <th className="px-6 py-3">
                    <span className="sr-only">Review</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.memberId} className="border-b border-line align-middle last:border-b-0">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={row.name} photoUrl={row.photoUrl} />
                        <span className="font-medium text-ink">{row.name}</span>
                      </div>
                    </td>
                    <td className="max-w-[320px] px-6 py-4">
                      <SectionChips sections={row.pendingSections} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusCell row={row} />
                    </td>
                    <td className="px-6 py-4 text-xs text-ink-3">
                      {row.waitingSince ? DATE_FORMAT.format(new Date(row.waitingSince)) : '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-ink-3">{DATE_FORMAT.format(new Date(row.lastActivity))}</td>
                    <td className="px-6 py-4 text-right">
                      <Button href={`/admin/member-edits/${row.memberId}`} size="sm" variant={row.pendingCount > 0 ? 'primary' : 'secondary'}>
                        {row.pendingCount > 0 ? 'Review' : 'View'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: stacked cards */}
          <ul className="flex flex-col gap-3 min-[768px]:hidden">
            {rows.map((row) => (
              <li key={row.memberId} className="rounded-card border border-line bg-bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar name={row.name} photoUrl={row.photoUrl} />
                    <span className="truncate font-medium text-ink">{row.name}</span>
                  </div>
                  <StatusCell row={row} />
                </div>
                {row.pendingSections.length > 0 && (
                  <div className="mt-3">
                    <SectionChips sections={row.pendingSections} />
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-ink-3">
                    {row.waitingSince
                      ? `Waiting since ${DATE_FORMAT.format(new Date(row.waitingSince))}`
                      : `Last activity ${DATE_FORMAT.format(new Date(row.lastActivity))}`}
                  </span>
                  <Button href={`/admin/member-edits/${row.memberId}`} size="sm" variant={row.pendingCount > 0 ? 'primary' : 'secondary'}>
                    {row.pendingCount > 0 ? 'Review' : 'View'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
