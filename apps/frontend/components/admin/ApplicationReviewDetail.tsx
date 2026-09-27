'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ApplicationStatusBadge, ReviewRow, ReviewListRow } from '@/components/shared/ApplicationReview';
import { REGIONS } from '@/components/apply/types';
import { reviewApplication } from '@/lib/api/applications';
import { ApiError } from '@/lib/api/client';
import type { ApplicationDto } from '@shared/membership-application';

const PRIORITY_LABEL: Record<1 | 2 | 3, string> = { 1: '1st preference', 2: '2nd preference', 3: '3rd preference' };

const TIER_OPTIONS: { value: 'budding_entrepreneur' | 'seasoned_professional'; label: string }[] = [
  { value: 'budding_entrepreneur', label: 'Budding Entrepreneur' },
  { value: 'seasoned_professional', label: 'Seasoned Professional' },
];

function formatCents(cents: number | null): string {
  if (cents === null) return '—';
  return `$${(cents / 100).toLocaleString()}`;
}

function monthLabel(month: number | undefined): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return month ? (MONTHS[month - 1] ?? '') : '';
}

function formatDateRange(
  startMonth: number | undefined,
  startYear: number,
  isCurrent: boolean,
  endMonth: number | undefined,
  endYear: number | undefined
): string {
  const start = [monthLabel(startMonth), startYear].filter(Boolean).join(' ');
  const end = isCurrent ? 'Present' : [monthLabel(endMonth), endYear].filter(Boolean).join(' ') || '—';
  return `${start} – ${end}`;
}

function todayIsoDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ApplicationReviewDetail({ application }: { application: ApplicationDto }) {
  const router = useRouter();
  const sortedPreferences = [...application.servicePreferences].sort((a, b) => a.priority - b.priority);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [approvedServiceId, setApprovedServiceId] = useState(sortedPreferences[0]?.serviceId ?? '');
  const [memberTier, setMemberTier] = useState(application.selectedTier ?? 'budding_entrepreneur');
  const [membershipStartedAt, setMembershipStartedAt] = useState(todayIsoDate());
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!approvedServiceId) {
      setError('Select which service to approve the applicant for.');
      return;
    }
    setError(null);
    setBusy('approve');
    try {
      await reviewApplication(application.id, {
        status: 'approved',
        approvedServiceId,
        memberTier,
        ...(membershipStartedAt ? { membershipStartedAt } : {}),
      });
      router.push('/admin/applications');
      router.refresh();
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
      router.push('/admin/applications');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject this application.');
      setBusy(null);
    }
  }

  const isReviewable = application.status === 'submitted' || application.status === 'under_review';

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start gap-6 max-[1023px]:flex-col">
        <div className="min-w-0 flex-1 rounded-2xl border border-line bg-bg-card divide-y divide-line">
          <div className="flex items-center gap-[18px] px-6 py-5">
            <div className="flex h-24 w-24 flex-none items-center justify-center overflow-hidden rounded-full border-2 border-line-2 bg-bg-alt text-ink-3">
              {application.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={application.photoUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs">No photo</span>
              )}
            </div>
            <div>
              <div className="text-title text-ink">
                {application.firstName} {application.lastName}
              </div>
              <div className="mt-1 text-xs text-ink-3">{application.contactEmail}</div>
            </div>
          </div>
          <ReviewRow label="Phone" value={application.phone ? `${application.phoneCountryCode ?? ''} ${application.phone}` : '—'} />
          <ReviewRow
            label="Location"
            value={[
              [application.city, application.state, application.country].filter(Boolean).join(', '),
              REGIONS.find((r) => r.value === application.region)?.label ?? application.region,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          />
          <ReviewRow label="LinkedIn" value={application.linkedinUrl ?? '—'} href={application.linkedinUrl ?? undefined} />
          <ReviewRow label="Bio" value={application.bio ?? '—'} multiline />
          <ReviewRow
            label="Experience"
            value={application.yearsOfExperience != null ? `${application.yearsOfExperience} years` : '—'}
          />
          <ReviewListRow
            label="Work history"
            items={application.workExperiences.map((w) => ({
              title: `${w.title} at ${w.company}`,
              detail: [
                w.city,
                formatDateRange(w.startMonth, w.startYear, w.isCurrent, w.endMonth, w.endYear),
              ]
                .filter(Boolean)
                .join(' · '),
              link: w.companyUrl ? { href: w.companyUrl, label: 'Company site' } : undefined,
            }))}
          />
          <ReviewListRow
            label="Education"
            items={application.educations.map((e) => ({
              title: e.fieldOfStudy ? `${e.degree} in ${e.fieldOfStudy}` : e.degree,
              detail: [e.institution, e.startYear || e.endYear ? `${e.startYear ?? '—'} – ${e.endYear ?? '—'}` : undefined]
                .filter(Boolean)
                .join(' · '),
            }))}
          />
          <ReviewListRow
            label="Services"
            items={sortedPreferences.map((p) => ({
              title: p.customLabel ? `${p.serviceName} (${p.customLabel})` : p.serviceName,
              detail: PRIORITY_LABEL[p.priority],
            }))}
          />
          <ReviewRow
            label="Rate"
            value={
              application.rateMinCents != null && application.rateMaxCents != null
                ? `${formatCents(application.rateMinCents)} – ${formatCents(application.rateMaxCents)} / hour`
                : '—'
            }
          />
          <ReviewListRow
            label="Peer references"
            items={application.peerReferences.map((r) => ({
              title: r.relationship ? `${r.name} — ${r.relationship}` : r.name,
              detail: [r.email, r.phone].filter(Boolean).join(' · '),
            }))}
          />
          <ReviewListRow
            label="Documents"
            items={application.documents.map((d) => ({
              title: d.filename,
              detail: `${(d.sizeBytes / 1024).toFixed(0)} KB`,
              link: { href: d.url, label: 'View' },
            }))}
          />
          <ReviewRow label="LinkedIn import consent" value={application.linkedinImportConsent ? 'Yes' : 'No'} />
          <ReviewRow label="Background check consent" value={application.backgroundCheckConsent ? 'Yes' : 'No'} />
          <ReviewRow label="Terms agreed" value={application.termsVersionAgreed ?? '—'} />
          <ReviewRow label="Privacy policy agreed" value={application.privacyVersionAgreed ?? '—'} />
        </div>

        <aside className="sticky top-24 w-[320px] flex-none max-[1023px]:static max-[1023px]:w-full">
          <Card padding="md">
            {isReviewable ? (
              <>
                <h2 className="text-title text-ink">Decision</h2>
                <p className="mt-1 text-sm text-ink-3">
                  Approving provisions a member profile and promotes this applicant&apos;s account to{' '}
                  <code>member</code> immediately.
                </p>

                <div className="mt-5 flex flex-col gap-4">
                  <Select
                    label="Approve for service"
                    value={approvedServiceId}
                    onChange={(e) => setApprovedServiceId(e.target.value)}
                    disabled={sortedPreferences.length === 0}
                  >
                    {sortedPreferences.map((p) => (
                      <option key={p.serviceId} value={p.serviceId}>
                        {p.customLabel ? `${p.serviceName} (${p.customLabel})` : p.serviceName} — priority {p.priority}
                      </option>
                    ))}
                  </Select>
                  <Select label="Member tier" value={memberTier} onChange={(e) => setMemberTier(e.target.value as typeof memberTier)}>
                    {TIER_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="date"
                    label="Membership start date"
                    value={membershipStartedAt}
                    onChange={(e) => setMembershipStartedAt(e.target.value)}
                  />

                  {rejecting ? (
                    <>
                      <Textarea label="Rejection reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                      <Button variant="secondary" fullWidth onClick={reject} disabled={busy !== null}>
                        {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
                      </Button>
                      <Button variant="ghost" fullWidth onClick={() => setRejecting(false)} disabled={busy !== null}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button fullWidth onClick={approve} disabled={busy !== null || sortedPreferences.length === 0}>
                        {busy === 'approve' ? 'Approving…' : 'Approve application'}
                      </Button>
                      <Button variant="secondary" fullWidth onClick={() => setRejecting(true)} disabled={busy !== null}>
                        Reject application
                      </Button>
                    </>
                  )}
                </div>

                {error && (
                  <div className="mt-4">
                    <ErrorBanner message={error} />
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-title text-ink">Status</h2>
                <div className="mt-3">
                  <ApplicationStatusBadge status={application.status} />
                </div>
                {application.status === 'rejected' && application.rejectionReason && (
                  <p className="mt-3 text-sm text-ink-3">{application.rejectionReason}</p>
                )}
                {application.status === 'approved' && (
                  <p className="mt-3 text-sm text-ink-3">
                    This application was approved — a member profile has been provisioned and the
                    applicant&apos;s account promoted to <code>member</code>.
                  </p>
                )}
              </>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
