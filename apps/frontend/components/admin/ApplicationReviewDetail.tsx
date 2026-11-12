'use client';

import Image from 'next/image';
import { mustHotlink } from '@/lib/images';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Input, Select, Textarea } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ApplicationStatusBadge, ReviewRow, ReviewListRow } from '@/components/shared/ApplicationReview';
import { REGIONS } from '@/components/apply/types';
import { reviewApplication } from '@/lib/api/applications';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import type { ApplicationDto } from '@shared/membership-application';
import type { CategoryDto } from '@shared/category';
import { ApplicationProfileEditor } from '@/components/admin/ApplicationProfileEditor';
import { ApprovedServicePicker } from '@/components/admin/ApprovedServicePicker';
import { useFieldErrors } from '@/components/apply/useFieldErrors';
import { backgroundErrors } from '@/lib/apply/background-errors';
import { rateErrors } from '@/lib/apply/rate-errors';
import { EMAIL_PATTERN } from '@/lib/apply/save-errors';
import { formFromApplication, profileOverrides } from '@/lib/admin/profile-overrides';
import type { WizardFormState } from '@/components/apply/types';
import { externalHref, externalLink } from '@/lib/members/format';
import { formatCents, formatDateRange } from '@/lib/apply/format';
import { serviceLabel, servicePath } from '@/lib/applications/service-path';

const PRIORITY_LABEL: Record<1 | 2 | 3, string> = { 1: '1st preference', 2: '2nd preference', 3: '3rd preference' };

const TIER_OPTIONS: { value: 'budding_entrepreneur' | 'seasoned_professional'; label: string }[] = [
  { value: 'budding_entrepreneur', label: 'Budding Professional (5–12 years)' },
  { value: 'seasoned_professional', label: 'Seasoned Professional (12+ years)' },
];

function todayIsoDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type ListEntry = { title: string; detail?: string };

function locationOf(a: ApplicationDto): string {
  return (
    [
      [a.city, a.state, a.country].filter(Boolean).join(', '),
      REGIONS.find((r) => r.value === a.region)?.label ?? a.region,
    ]
      .filter(Boolean)
      .join(' · ') || '—'
  );
}

function phoneOf(a: ApplicationDto): string {
  return a.phone ? `${a.phoneCountryCode ?? ''} ${a.phone}` : '—';
}

function rateOf(a: ApplicationDto): string {
  return a.rateMinCents != null && a.rateMaxCents != null
    ? `${formatCents(a.rateMinCents)} – ${formatCents(a.rateMaxCents)} / hour`
    : '—';
}

function workEntries(a: ApplicationDto): ListEntry[] {
  return a.workExperiences.map((w) => ({
    title: `${w.title} at ${w.company}`,
    detail: [w.city, formatDateRange(w.startMonth, w.startYear, w.isCurrent, w.endMonth, w.endYear)]
      .filter(Boolean)
      .join(' · '),
  }));
}

function educationEntries(a: ApplicationDto): ListEntry[] {
  return a.educations.map((e) => ({
    title: e.fieldOfStudy ? `${e.degree} in ${e.fieldOfStudy}` : e.degree,
    detail: [e.institution, e.startYear || e.endYear ? `${e.startYear ?? '—'} – ${e.endYear ?? '—'}` : undefined]
      .filter(Boolean)
      .join(' · '),
  }));
}

function serviceEntries(a: ApplicationDto): ListEntry[] {
  return [...a.servicePreferences]
    .sort((x, y) => x.priority - y.priority)
    .map((p) => ({
      title: serviceLabel(p),
      detail: `${servicePath(p)} · ${PRIORITY_LABEL[p.priority]}`,
    }));
}

function referenceEntries(a: ApplicationDto): ListEntry[] {
  return a.peerReferences.map((r) => ({
    title: r.relationship ? `${r.name} — ${r.relationship}` : r.name,
    detail: [r.email, r.phone].filter(Boolean).join(' · '),
  }));
}

/**
 * `previous` is an optional earlier version of the same application (e.g. before a resubmission).
 * When supplied, every field that differs is highlighted in red (old struck through, new shown).
 * The current API exposes no prior snapshot, so callers omit it today and nothing is highlighted.
 */
export function ApplicationReviewDetail({
  application: original,
  categories,
  previous = null,
}: {
  application: ApplicationDto;
  /** The active taxonomy, for approving the applicant for any service. */
  categories: CategoryDto[];
  previous?: ApplicationDto | null;
}) {
  const router = useRouter();

  // Admin corrections: edited as a wizard form, sent as profileOverrides on approve, applied only to
  // the member profile — the application itself is never changed.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => formFromApplication(original));
  const { errors: fieldErrors, setErrors: setFieldErrors, clearErrors } = useFieldErrors();
  const update = (patch: Partial<WizardFormState>) => setForm((f) => ({ ...f, ...patch }));
  const overrides = profileOverrides(original, form);
  const correctedCount = Object.keys(overrides).length;
  // Everything below renders the application as it will be approved; with corrections, the
  // applicant's original goes in as `previous`, so each corrected field shows the old value too.
  // Region is derived from country server-side, so a corrected country leaves it to the backend.
  const application: ApplicationDto = correctedCount
    ? { ...original, ...overrides, region: overrides.country !== undefined ? null : original.region }
    : original;
  const prev = correctedCount ? original : previous;
  const sortedPreferences = [...application.servicePreferences].sort((a, b) => a.priority - b.priority);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [approvedServiceId, setApprovedServiceId] = useState(sortedPreferences[0]?.serviceId ?? '');
  const [memberTier, setMemberTier] = useState(application.selectedTier ?? 'budding_entrepreneur');
  const [tierTouched, setTierTouched] = useState(false);
  const [membershipStartedAt, setMembershipStartedAt] = useState(todayIsoDate());
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A corrected years of experience moves the tier with it (same rule as the backend's
  // computeTier), until the admin picks a tier themselves.
  const correctedYears = overrides.yearsOfExperience;
  useEffect(() => {
    if (tierTouched || correctedYears === undefined) return;
    setMemberTier(correctedYears > 12 ? 'seasoned_professional' : 'budding_entrepreneur');
  }, [correctedYears, tierTouched]);

  function discardCorrections() {
    setForm(formFromApplication(original));
    setFieldErrors({});
  }

  function correctionErrors(): Record<string, string> {
    if (correctedCount === 0) return {};
    const e: Record<string, string> = {
      ...backgroundErrors(form),
      ...rateErrors(form.rateMinDollars, form.rateMaxDollars),
    };
    if (!form.firstName.trim()) e.firstName = 'First name is required.';
    if (!form.lastName.trim()) e.lastName = 'Last name is required.';
    for (const field of ['contactEmail', 'workEmail'] as const) {
      if (form[field].trim() && !EMAIL_PATTERN.test(form[field].trim())) e[field] = 'Enter a valid email address.';
    }
    return e;
  }

  async function approve() {
    if (!approvedServiceId) {
      setError('Select which service to approve the applicant for.');
      return;
    }
    const invalid = correctionErrors();
    if (Object.keys(invalid).length > 0) {
      setFieldErrors(invalid);
      setEditing(true);
      setError('Fix the highlighted fields before approving.');
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
        ...(correctedCount ? { profileOverrides: overrides } : {}),
      });
      router.push('/admin/applications');
      router.refresh();
    } catch (err) {
      setError(
        apiErrorMessage(err, 'Failed to approve this application.', {
          INVALID_RATE_RANGE: 'The maximum rate must be greater than the minimum rate.',
          APPROVED_SERVICE_INVALID: 'That service is no longer available. Pick another one.',
          APPLICATION_INCOMPLETE: 'Add the missing country or years of experience before approving.',
        })
      );
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
      setError(apiErrorMessage(err, 'Failed to reject this application.'));
      setBusy(null);
    }
  }

  const isReviewable = application.status === 'submitted' || application.status === 'under_review';

  return (
    <div className="flex flex-col gap-8">
      {isReviewable && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-bg-card px-6 py-4 max-[480px]:px-5">
          <div className="min-w-0 flex-1 basis-64">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
              Applicant details
              {correctedCount > 0 && (
                <Badge variant="warning">
                  {correctedCount} {correctedCount === 1 ? 'field' : 'fields'} corrected
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-3">
              Corrections apply to the member profile only — the application stays as submitted.
            </p>
          </div>
          <div className="flex items-center gap-3 max-[480px]:w-full">
            {correctedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={discardCorrections}>
                Discard corrections
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Done editing' : 'Edit details'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-6 max-[1023px]:flex-col">
        {editing ? (
          <div className="min-w-0 flex-1 max-[1023px]:w-full">
            <ApplicationProfileEditor
              form={form}
              update={update}
              errors={fieldErrors}
              setErrors={setFieldErrors}
              clearErrors={clearErrors}
            />
          </div>
        ) : (
          <div className="min-w-0 flex-1 rounded-2xl border border-line bg-bg-card divide-y divide-line">
            <div className="flex items-center gap-[18px] px-6 py-5">
              <div className="flex h-24 w-24 flex-none items-center justify-center overflow-hidden rounded-full border-2 border-line-2 bg-bg-alt text-ink-3">
                {application.photoUrl ? (
                  <Image
                    src={application.photoUrl}
                    unoptimized={mustHotlink(application.photoUrl)}
                    alt="Profile"
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
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
            <ReviewRow
              label="Work email"
              value={application.workEmail ?? '—'}
              previous={prev ? (prev.workEmail ?? '—') : undefined}
            />
            <ReviewRow label="Phone" value={phoneOf(application)} previous={prev ? phoneOf(prev) : undefined} />
            <ReviewRow
              label="Location"
              value={locationOf(application)}
              previous={prev ? locationOf(prev) : undefined}
            />
            <ReviewRow
              label="LinkedIn"
              value={application.linkedinUrl ?? '—'}
              href={externalHref(application.linkedinUrl) ?? undefined}
              previous={prev ? (prev.linkedinUrl ?? '—') : undefined}
            />
            <ReviewRow
              label="Bio"
              value={application.bio ?? '—'}
              multiline
              previous={prev ? (prev.bio ?? '—') : undefined}
            />
            <ReviewRow
              label="Experience"
              value={application.yearsOfExperience != null ? `${application.yearsOfExperience} years` : '—'}
              previous={prev ? (prev.yearsOfExperience != null ? `${prev.yearsOfExperience} years` : '—') : undefined}
            />
            <ReviewListRow
              label="Work history"
              items={application.workExperiences.map((w, idx) => ({
                ...workEntries(application)[idx],
                body: w.description,
                link: externalLink(w.companyUrl, 'Company site'),
              }))}
              previousItems={prev ? workEntries(prev) : null}
            />
            <ReviewListRow
              label="Education"
              items={educationEntries(application)}
              previousItems={prev ? educationEntries(prev) : null}
            />
            <ReviewListRow
              label="Services"
              items={serviceEntries(application)}
              previousItems={prev ? serviceEntries(prev) : null}
            />
            <ReviewRow label="Rate" value={rateOf(application)} previous={prev ? rateOf(prev) : undefined} />
            <ReviewListRow
              label="Peer references"
              items={referenceEntries(application)}
              previousItems={prev ? referenceEntries(prev) : null}
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
        )}

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
                  <ApprovedServicePicker
                    preferences={application.servicePreferences}
                    categories={categories}
                    value={approvedServiceId}
                    onChange={setApprovedServiceId}
                  />
                  <Select
                    label="Member tier"
                    value={memberTier}
                    onChange={(e) => {
                      setMemberTier(e.target.value as typeof memberTier);
                      setTierTouched(true);
                    }}
                  >
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
                      <Textarea
                        label="Rejection reason"
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <Button variant="secondary" fullWidth onClick={reject} disabled={busy !== null}>
                        {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
                      </Button>
                      <Button variant="ghost" fullWidth onClick={() => setRejecting(false)} disabled={busy !== null}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button fullWidth onClick={approve} disabled={busy !== null}>
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
                    This application was approved — a member profile has been provisioned and the applicant&apos;s
                    account promoted to <code>member</code>.
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
