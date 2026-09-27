'use client';

import { useMemo, useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { ApplicationStatusBadge, STATUS_LABEL } from '@/components/shared/ApplicationReview';
import type { AdminApplicationListItemDto, ApplicationStatus } from '@shared/membership-application';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

type SortKey = 'name' | 'location' | 'service' | 'category' | 'experience' | 'created' | 'status';
type SortDir = 'asc' | 'desc';

function sortedPreferences(application: AdminApplicationListItemDto) {
  return [...application.servicePreferences].sort((a, b) => a.priority - b.priority);
}

function formatPhone(application: AdminApplicationListItemDto): string {
  if (!application.phone) return '—';
  return [application.phoneCountryCode, application.phone].filter(Boolean).join(' ');
}

function sortValue(application: AdminApplicationListItemDto, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return `${application.firstName} ${application.lastName}`.toLowerCase();
    case 'location':
      return `${application.country} ${application.state ?? ''}`.toLowerCase();
    case 'service':
      return sortedPreferences(application)[0]?.serviceName.toLowerCase() ?? '';
    case 'category':
      return sortedPreferences(application)[0]?.categoryName.toLowerCase() ?? '';
    case 'experience':
      // Missing experience sorts to the bottom regardless of direction.
      return application.yearsOfExperience ?? -1;
    case 'created':
      return new Date(application.createdAt).getTime();
    case 'status':
      return STATUS_LABEL[application.status];
  }
}

function SortableHeader({
  label,
  sortKeyName,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKeyName: SortKey;
  activeKey: SortKey | null;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKeyName;
  return (
    <th className="px-6 py-3">
      <button
        type="button"
        onClick={() => onSort(sortKeyName)}
        className="inline-flex items-center gap-1 hover:text-ink"
      >
        {label}
        <span className={active ? 'text-ink' : 'text-ink-4'} aria-hidden="true">
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

export function AdminApplicationsTable({
  initialApplications,
}: {
  initialApplications: AdminApplicationListItemDto[];
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const statusesPresent = useMemo(
    () => [...new Set(initialApplications.map((a) => a.status))],
    [initialApplications]
  );

  const applications = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = initialApplications.filter((application) => {
      const matchesQuery =
        q.length === 0 || `${application.firstName} ${application.lastName}`.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || application.status === statusFilter;
      return matchesQuery && matchesStatus;
    });

    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [initialApplications, query, statusFilter, sortKey, sortDir]);

  if (initialApplications.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-3">All caught up — nothing left to review.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Input
            label="Search by name"
            placeholder="Applicant name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-full max-w-[220px]">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'all')}
          >
            <option value="all">All statuses</option>
            {statusesPresent.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {applications.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">No applications match this filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[1080px] border-collapse">
            <thead>
              <tr className="border-b border-line bg-bg-alt text-left text-xs font-medium text-ink-3">
                <SortableHeader label="Applicant" sortKeyName="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Location" sortKeyName="location" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Services" sortKeyName="service" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Category" sortKeyName="category" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Experience" sortKeyName="experience" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Created" sortKeyName="created" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Status" sortKeyName="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-6 py-3">
                  <span className="sr-only">Review</span>
                </th>
              </tr>
            </thead>
            <tbody className="px-6">
              {applications.map((application) => (
                <tr key={application.id} className="border-b border-line align-top last:border-b-0">
                  <td className="px-6 py-4">
                    <div className="font-medium text-ink">
                      {application.firstName} {application.lastName}
                    </div>
                    <div className="text-xs text-ink-3">{application.contactEmail}</div>
                    <div className="text-xs text-ink-3">{formatPhone(application)}</div>
                    {application.linkedinUrl && (
                      <a
                        href={application.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent underline hover:text-ink"
                      >
                        LinkedIn
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-ink-2">
                    <div>{application.country}</div>
                    {application.state && <div className="text-xs text-ink-3">{application.state}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-ink-2">
                    {sortedPreferences(application).length === 0 ? (
                      '—'
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {sortedPreferences(application).map((p) => (
                          <span key={p.serviceId}>
                            {p.customLabel ? `${p.serviceName} (${p.customLabel})` : p.serviceName}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-ink-2">
                    {sortedPreferences(application).length === 0 ? (
                      '—'
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {sortedPreferences(application).map((p) => (
                          <span key={p.serviceId}>{p.categoryName}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-ink-2">
                    {application.yearsOfExperience != null ? `${application.yearsOfExperience} yrs` : '—'}
                  </td>
                  <td className="px-6 py-4 text-xs text-ink-3">{DATE_FORMAT.format(new Date(application.createdAt))}</td>
                  <td className="px-6 py-4 text-sm text-ink-2">
                    <ApplicationStatusBadge status={application.status} />
                    {application.rejectionReason && (
                      <div className="mt-1 max-w-[220px] text-xs text-ink-3">{application.rejectionReason}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Button href={`/admin/applications/${application.id}`} size="sm" variant="secondary">
                      Review
                    </Button>
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
