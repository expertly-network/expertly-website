'use client';

import { useState } from 'react';
import { Badge, Button, Textarea } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { reviewApplication } from '@/lib/api/applications';
import { ApiError } from '@/lib/api/client';
import type { AdminApplicationListItemDto } from '@shared/membership-application';

function formatCents(cents: number | null): string {
  if (cents === null) return '—';
  return `$${(cents / 100).toLocaleString()}`;
}

const TIER_LABEL: Record<string, string> = {
  budding_entrepreneur: 'Budding Entrepreneur',
  seasoned_professional: 'Seasoned Professional',
};

function AdminApplicationRow({
  application,
  onDecided,
}: {
  application: AdminApplicationListItemDto;
  onDecided: (id: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setError(null);
    setBusy('approve');
    try {
      await reviewApplication(application.id, { status: 'approved' });
      onDecided(application.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve this application.');
      setBusy(null);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    setError(null);
    setBusy('reject');
    try {
      await reviewApplication(application.id, { status: 'rejected', rejectionReason: reason.trim() });
      onDecided(application.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject this application.');
      setBusy(null);
    }
  }

  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <td className="px-6 py-4">
        <div className="font-medium text-ink">
          {application.firstName} {application.lastName}
        </div>
        <div className="text-xs text-ink-3">{application.contactEmail}</div>
        <div className="mt-1 text-xs text-ink-3">{application.country}</div>
      </td>
      <td className="px-6 py-4 text-sm text-ink-2">
        {application.selectedTier ? TIER_LABEL[application.selectedTier] ?? application.selectedTier : '—'}
        {application.billingPeriod && <span className="text-ink-3"> · {application.billingPeriod}</span>}
      </td>
      <td className="px-6 py-4 text-sm text-ink-2">
        {formatCents(application.amountDueCents)}
        <div>
          <Badge variant={application.paymentStatus === 'paid' ? 'brand' : 'neutral'}>
            {application.paymentStatus}
          </Badge>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-ink-2">
        <Badge variant="neutral">{application.status.replace('_', ' ')}</Badge>
      </td>
      <td className="px-6 py-4">
        {!rejecting ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={approve} disabled={busy !== null}>
              {busy === 'approve' ? 'Approving…' : 'Approve'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== null}>
              Reject
            </Button>
          </div>
        ) : (
          <div className="flex w-64 flex-col gap-2">
            <Textarea
              label="Rejection reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={reject} disabled={busy !== null}>
                {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={busy !== null}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {error && <div className="mt-2 max-w-64"><ErrorBanner message={error} /></div>}
      </td>
    </tr>
  );
}

export function AdminApplicationsTable({
  initialApplications,
}: {
  initialApplications: AdminApplicationListItemDto[];
}) {
  const [applications, setApplications] = useState(initialApplications);

  function handleDecided(id: string) {
    // Reviewed applications leave the queue immediately — this table only ever shows the
    // default "submitted or under_review" bucket, matching what the server component fetched.
    setApplications((prev) => prev.filter((a) => a.id !== id));
  }

  if (applications.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-3">All caught up — nothing left to review.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-line bg-bg-alt text-left text-xs font-medium text-ink-3">
            <th className="px-6 py-3">Applicant</th>
            <th className="px-6 py-3">Tier</th>
            <th className="px-6 py-3">Payment</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3">Decision</th>
          </tr>
        </thead>
        <tbody className="px-6">
          {applications.map((application) => (
            <AdminApplicationRow key={application.id} application={application} onDecided={handleDecided} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
