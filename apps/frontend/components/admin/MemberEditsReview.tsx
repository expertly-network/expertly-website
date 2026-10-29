'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Textarea, type BadgeVariant } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { SECTION_TITLES } from '@/components/members/edit/sectionFieldConfig';
import { reviewMemberEdit } from '@/lib/api/members';
import { ApiError } from '@/lib/api/client';
import { ChangedSegments, ChangedValue } from '@/components/shared/ChangedValue';
import {
  countChanges,
  diffEdit,
  metaSegments,
  viewOfItem,
  type FieldChange,
  type ItemChange,
  type ItemView,
} from '@/lib/members/edit-diff';
import type {
  AdminMemberEditsDetailDto,
  MemberEditItemDecision,
  MemberProfileEditDto,
  ProofAttachment,
  ReviewMemberEditItemRequest,
} from '@shared/member';
import { externalHref } from '@/lib/members/format';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

// Sections where each item carries its own proof; education / work_experiences share one
// edit-level proof for the whole batch.
const PER_ITEM_PROOF_SECTIONS = new Set(['engagements', 'testimonials', 'awards', 'key_clients']);

const DECISION_OPTIONS: { value: MemberEditItemDecision; label: string; short: string }[] = [
  { value: 'approved_verified', label: 'Approve + Verified badge', short: 'Verified' },
  { value: 'approved_hygiene', label: 'Approve, no badge', short: 'Live, no badge' },
  { value: 'rejected', label: 'Reject', short: 'Rejected' },
];

const DECISION_BADGE: Record<MemberEditItemDecision, BadgeVariant> = {
  approved_verified: 'success',
  approved_hygiene: 'warning',
  rejected: 'danger',
};

const NO_PROOF_REASON = 'Proof not attached.';

interface ItemDecisionState {
  decision: MemberEditItemDecision | null;
  reason: string;
}

const KIND_BADGE: Record<ItemChange['kind'], { label: string; variant: BadgeVariant }> = {
  added: { label: 'Added', variant: 'success' },
  removed: { label: 'Removed', variant: 'danger' },
  changed: { label: 'Changed', variant: 'info' },
  unchanged: { label: 'Unchanged', variant: 'neutral' },
};

// A rejected edit with no reviewer was closed automatically when the member resubmitted.
function decisionOf(edit: MemberProfileEditDto): { label: string; variant: BadgeVariant } {
  if (edit.status === 'verified') return { label: 'Approved', variant: 'success' };
  if (edit.status === 'rejected' && !edit.reviewedBy) return { label: 'Replaced', variant: 'neutral' };
  if (edit.status === 'rejected') return { label: 'Rejected', variant: 'danger' };
  return { label: 'Pending', variant: 'warning' };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

// ── Proof ────────────────────────────────────────────────────────────────────────────────────

function ProofLinks({ attachments, fileUrls }: { attachments: ProofAttachment[]; fileUrls: Record<string, string> }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {attachments.map((a, i) => {
        // Links are member-typed; only a safe http(s) address is ever made clickable.
        const href = a.type === 'file' ? fileUrls[a.url] : externalHref(a.url);
        return (
          <li key={`${a.url}-${i}`}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-[260px] items-center gap-1.5 rounded-input border border-line bg-bg-card px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent"
              >
                {a.type === 'file' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                )}
                <span className="truncate">{a.label}</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-input border border-dashed border-line-2 px-2.5 py-1 text-xs text-ink-3">
                {a.label} — file unavailable
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Diff rendering ───────────────────────────────────────────────────────────────────────────

function FieldDiff({ fields }: { fields: FieldChange[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-[120px_1fr_1fr] gap-4 bg-bg-alt px-4 py-2 text-xs font-medium text-ink-3 max-[640px]:hidden">
        <span>Field</span>
        <span>Current</span>
        <span>Proposed</span>
      </div>
      {fields.map((f) => (
        <div
          key={f.label}
          className="grid grid-cols-[120px_1fr_1fr] gap-4 px-4 py-3 text-sm max-[640px]:grid-cols-1 max-[640px]:gap-1.5"
        >
          <span className="flex items-start gap-2 text-mono-label text-ink-3">
            {f.label}
            {f.changed && <Badge variant="info">Changed</Badge>}
          </span>
          <span className={`whitespace-pre-wrap break-words ${f.changed ? 'text-error line-through decoration-error' : 'text-ink-2'}`}>
            <span className="mr-1.5 text-xs text-ink-4 no-underline min-[641px]:hidden">Current:</span>
            {f.before || '—'}
          </span>
          <span
            className={`whitespace-pre-wrap break-words rounded-md ${
              f.changed ? 'bg-[color-mix(in_oklab,var(--error)_8%,transparent)] px-2 py-1 font-medium text-error' : 'text-ink-2'
            }`}
          >
            <span className="mr-1.5 text-xs font-normal text-ink-4 min-[641px]:hidden">Proposed:</span>
            {f.after || '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

function Logo({ view, fileUrls }: { view: ItemView; fileUrls: Record<string, string> }) {
  const src = view.logoUploadPath ? fileUrls[view.logoUploadPath] : view.logoUrl;
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-10 w-10 flex-none rounded-lg border border-line object-cover" />
  );
}

function ItemBody({ view, before, struck }: { view: ItemView; before?: ItemView | null; struck?: boolean }) {
  if (struck) {
    return (
      <div className="min-w-0">
        <div className="text-sm font-semibold text-error line-through decoration-error">{view.title || 'Untitled'}</div>
        {view.meta && <div className="mt-0.5 break-words text-xs text-error line-through decoration-error">{view.meta}</div>}
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <div className="text-sm font-semibold text-ink">
        {before ? <ChangedValue before={before.title} after={view.title || 'Untitled'} /> : view.title || 'Untitled'}
      </div>
      {(view.meta || before?.meta) && (
        <div className="mt-0.5 break-words text-xs text-ink-3">
          {before ? <ChangedSegments before={metaSegments(before.meta)} after={metaSegments(view.meta)} /> : view.meta}
        </div>
      )}
      {(view.body || before?.body) && (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-ink-2">
          {before ? <ChangedValue before={before.body} after={view.body} /> : view.body}
        </p>
      )}
    </div>
  );
}

function DecisionControl({
  hasProof,
  state,
  onChange,
  disabled,
}: {
  hasProof: boolean;
  state: ItemDecisionState;
  onChange: (next: ItemDecisionState) => void;
  disabled: boolean;
}) {
  function pick(decision: MemberEditItemDecision) {
    // Pre-fill the most common hygiene reason so the admin only has to confirm it.
    const reason = decision === 'approved_hygiene' && !state.reason && !hasProof ? NO_PROOF_REASON : state.reason;
    onChange({ decision, reason: decision === 'approved_verified' ? '' : reason });
  }
  const needsReason = state.decision === 'approved_hygiene' || state.decision === 'rejected';
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div role="group" aria-label="Decision" className="flex flex-wrap gap-2">
        {DECISION_OPTIONS.map((opt) => {
          const blocked = opt.value === 'approved_verified' && !hasProof;
          const active = state.decision === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              disabled={disabled || blocked}
              title={blocked ? 'Attach proof to verify — the member did not provide any.' : undefined}
              onClick={() => pick(opt.value)}
              className={`rounded-input border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? opt.value === 'rejected'
                    ? 'border-error bg-[color-mix(in_oklab,var(--error)_10%,transparent)] text-error'
                    : 'border-accent bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-accent'
                  : 'border-line bg-bg-card text-ink-2 hover:border-line-2'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {!hasProof && <p className="mt-1.5 text-xs text-ink-3">No proof attached, so the Verified badge is unavailable.</p>}
      {needsReason && (
        <div className="mt-2.5">
          <Textarea
            label={state.decision === 'rejected' ? 'Rejection note (shown to the member)' : 'Why no badge? (shown to the member)'}
            rows={2}
            value={state.reason}
            disabled={disabled}
            onChange={(e) => onChange({ ...state, reason: e.target.value })}
            placeholder={state.decision === 'rejected' ? 'e.g. The certificate does not match the award title.' : NO_PROOF_REASON}
          />
        </div>
      )}
    </div>
  );
}

function ItemsDiff({
  items,
  section,
  fileUrls,
  hasBatchProof,
  decisions,
  onDecision,
  disabled,
}: {
  items: ItemChange[];
  section: string;
  fileUrls: Record<string, string>;
  hasBatchProof: boolean;
  decisions: Record<number, ItemDecisionState>;
  onDecision: (index: number, next: ItemDecisionState) => void;
  disabled: boolean;
}) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const unchanged = items.filter((i) => i.kind === 'unchanged').length;
  const visible = showUnchanged ? items : items.filter((i) => i.kind !== 'unchanged');
  const perItemProof = PER_ITEM_PROOF_SECTIONS.has(section);

  return (
    <div className="flex flex-col gap-2.5">
      {visible.length === 0 && <p className="text-sm text-ink-3">No entries changed — this resubmits the section as-is.</p>}
      {visible.map((change, i) => {
        const badge = KIND_BADGE[change.kind];
        const hasProof = perItemProof ? change.proofAttachments.length > 0 : hasBatchProof;
        const state = change.index !== null ? decisions[change.index] : undefined;
        return (
          <div
            key={i}
            className={`rounded-xl border bg-bg-card px-4 py-3 ${
              change.kind === 'changed' || change.kind === 'added' ? 'border-[color-mix(in_oklab,var(--error)_40%,transparent)]' : 'border-line'
            } ${change.kind === 'unchanged' ? 'opacity-80' : ''}`}
          >
            <div className="flex items-start gap-3">
              <Logo view={change.item} fileUrls={fileUrls} />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {change.item.logoUploadPath && <Badge variant="brand">New logo</Badge>}
                </div>
                <ItemBody view={change.item} before={change.before} struck={change.kind === 'removed'} />
                {change.kind === 'removed' && (
                  <p className="mt-1.5 text-xs text-ink-3">Dropped by the member — removed from the live profile when you submit.</p>
                )}
                {change.kind !== 'removed' && perItemProof && (
                  <div className="mt-2.5">
                    {change.proofAttachments.length > 0 ? (
                      <ProofLinks attachments={change.proofAttachments} fileUrls={fileUrls} />
                    ) : (
                      <Badge variant="warning">No proof attached</Badge>
                    )}
                  </div>
                )}
                {change.index !== null && state && (
                  <DecisionControl
                    hasProof={hasProof}
                    state={state}
                    disabled={disabled}
                    onChange={(next) => onDecision(change.index as number, next)}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
      {unchanged > 0 && (
        <button
          type="button"
          onClick={() => setShowUnchanged((v) => !v)}
          className="self-start text-xs font-medium text-ink-3 underline hover:text-ink"
        >
          {showUnchanged
            ? 'Hide unchanged entries'
            : `Show ${unchanged} unchanged ${unchanged === 1 ? 'entry' : 'entries'} (pre-set — still submitted with your decisions)`}
        </button>
      )}
    </div>
  );
}

// ── One pending edit ─────────────────────────────────────────────────────────────────────────

function PendingEditCard({
  edit,
  detail,
  onDecided,
}: {
  edit: MemberProfileEditDto;
  detail: AdminMemberEditsDetailDto;
  onDecided: () => void;
}) {
  const { current } = detail;
  const diff = useMemo(() => diffEdit(edit.section, edit.payload, current), [edit, current]);
  const changes = countChanges(diff);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | 'items' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overallNote, setOverallNote] = useState('');

  const batchProof: ProofAttachment[] = [
    ...(edit.proofFileUrl ? [{ type: 'file' as const, url: edit.proofFileUrl, label: 'Supporting document' }] : []),
    ...(edit.proofLink ? [{ type: 'link' as const, url: edit.proofLink, label: edit.proofLink }] : []),
  ];
  const hasBatchProof = batchProof.length > 0;
  const perItemProof = PER_ITEM_PROOF_SECTIONS.has(edit.section);

  // Per-item mode applies to array sections that actually carry entries; headline_bio / contact
  // and a fully cleared section are reviewed as a whole.
  const itemChanges = diff.shape === 'items' ? diff.items : [];
  const proposedItems = itemChanges.filter((c) => c.index !== null);
  const perItemMode = diff.shape === 'items' && proposedItems.length > 0;

  const [decisions, setDecisions] = useState<Record<number, ItemDecisionState>>(() => {
    const init: Record<number, ItemDecisionState> = {};
    for (const c of proposedItems) {
      if (c.index === null) continue;
      const hasProof = perItemProof ? c.proofAttachments.length > 0 : hasBatchProof;
      if (c.kind === 'unchanged') {
        // Unchanged entries are resubmitted too; pre-set them so only real changes need attention.
        init[c.index] = hasProof
          ? { decision: 'approved_verified', reason: '' }
          : { decision: 'approved_hygiene', reason: NO_PROOF_REASON };
      } else {
        init[c.index] = { decision: null, reason: '' };
      }
    }
    return init;
  });

  function setDecision(index: number, next: ItemDecisionState) {
    setDecisions((d) => ({ ...d, [index]: next }));
  }

  function autoFill() {
    setDecisions((d) => {
      const out = { ...d };
      for (const c of proposedItems) {
        if (c.index === null || out[c.index]?.decision !== null) continue;
        const hasProof = perItemProof ? c.proofAttachments.length > 0 : hasBatchProof;
        out[c.index] = hasProof
          ? { decision: 'approved_verified', reason: '' }
          : { decision: 'approved_hygiene', reason: NO_PROOF_REASON };
      }
      return out;
    });
  }

  const undecided = proposedItems.filter((c) => c.index !== null && decisions[c.index]?.decision === null).length;
  const missingReason = proposedItems.filter((c) => {
    const st = c.index !== null ? decisions[c.index] : undefined;
    return st && (st.decision === 'approved_hygiene' || st.decision === 'rejected') && !st.reason.trim();
  }).length;
  const counts = {
    approved_verified: 0,
    approved_hygiene: 0,
    rejected: 0,
  };
  for (const st of Object.values(decisions)) if (st.decision) counts[st.decision] += 1;

  async function submitItems() {
    if (undecided > 0) {
      setError(`Decide every entry first — ${undecided} still need a decision.`);
      return;
    }
    if (missingReason > 0) {
      setError('Add a reason for every entry that is rejected or approved without the badge.');
      return;
    }
    const items: ReviewMemberEditItemRequest[] = proposedItems.flatMap((c) => {
      const st = c.index !== null ? decisions[c.index] : undefined;
      if (c.index === null || !st || st.decision === null) return [];
      return [
        {
          index: c.index,
          decision: st.decision,
          ...(st.decision === 'approved_verified' ? {} : { reason: st.reason.trim() }),
        },
      ];
    });
    setError(null);
    setBusy('items');
    try {
      await reviewMemberEdit(edit.id, { items, ...(overallNote.trim() ? { reviewNote: overallNote.trim() } : {}) });
      onDecided();
    } catch (err) {
      setError(errorMessage(err, 'Failed to submit these decisions.'));
      setBusy(null);
    }
  }

  async function decide(status: 'verified' | 'rejected') {
    if (status === 'rejected' && !reason.trim()) {
      setError('Add a reason — the member will see it on their profile.');
      return;
    }
    setError(null);
    setBusy(status === 'verified' ? 'approve' : 'reject');
    try {
      await reviewMemberEdit(edit.id, status === 'verified' ? { status } : { status, reviewNote: reason.trim() });
      onDecided();
    } catch (err) {
      setError(errorMessage(err, status === 'verified' ? 'Failed to approve this change.' : 'Failed to reject this change.'));
      setBusy(null);
    }
  }

  return (
    <Card padding="md" className="shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-title text-ink">{SECTION_TITLES[edit.section]}</h3>
          <p className="mt-1 text-caption text-ink-3">
            Submitted {DATE_FORMAT.format(new Date(edit.submittedAt))} ·{' '}
            {changes === 0 ? 'no visible changes' : `${changes} ${changes === 1 ? 'change' : 'changes'}`}
          </p>
        </div>
        <Badge variant="warning">Pending</Badge>
      </div>

      <div className="mt-5">
        {diff.shape === 'fields' ? (
          <FieldDiff fields={diff.fields} />
        ) : perItemMode ? (
          <ItemsDiff
            items={diff.items}
            section={edit.section}
            fileUrls={detail.fileUrls}
            hasBatchProof={hasBatchProof}
            decisions={decisions}
            onDecision={setDecision}
            disabled={busy !== null}
          />
        ) : (
          <p className="text-sm text-ink-3">The member cleared this section — approving removes every entry.</p>
        )}
      </div>

      {batchProof.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-mono-label text-ink-3">Proof for this section</div>
          <ProofLinks attachments={batchProof} fileUrls={detail.fileUrls} />
        </div>
      )}

      <div className="mt-5 border-t border-line pt-5">
        {perItemMode ? (
          <div className="flex flex-col gap-3">
            <Textarea
              label="Overall note (optional)"
              rows={2}
              value={overallNote}
              disabled={busy !== null}
              onChange={(e) => setOverallNote(e.target.value)}
            />
            <p className="text-xs text-ink-3">
              {counts.approved_verified} verified · {counts.approved_hygiene} live without badge · {counts.rejected} rejected
              {undecided > 0 && ` · ${undecided} undecided`}
            </p>
            <div className="flex flex-wrap gap-2 max-[480px]:flex-col">
              <Button onClick={submitItems} disabled={busy !== null}>
                {busy === 'items' ? 'Submitting…' : 'Submit decisions'}
              </Button>
              {undecided > 0 && (
                <Button variant="secondary" onClick={autoFill} disabled={busy !== null}>
                  Pre-fill undecided (verify if proof, else no badge)
                </Button>
              )}
            </div>
          </div>
        ) : rejecting ? (
          <div className="flex flex-col gap-3">
            <Textarea
              label="Reason for rejecting (shown to the member)"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The certificate attached doesn't match the award title."
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => decide('rejected')} disabled={busy !== null}>
                {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
              </Button>
              <Button variant="ghost" onClick={() => { setRejecting(false); setError(null); }} disabled={busy !== null}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 max-[480px]:flex-col">
            <Button onClick={() => decide('verified')} disabled={busy !== null}>
              {busy === 'approve' ? 'Approving…' : 'Approve & publish'}
            </Button>
            <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== null}>
              Reject
            </Button>
          </div>
        )}
        {error && (
          <div className="mt-3">
            <ErrorBanner message={error} />
          </div>
        )}
      </div>
    </Card>
  );
}

// ── A reviewed edit: per-item outcomes ───────────────────────────────────────────────────────

function ItemOutcomes({ edit }: { edit: MemberProfileEditDto }) {
  const reviews = edit.itemReviews;
  if (!reviews || reviews.length === 0) return null;
  const payload = Array.isArray(edit.payload) ? (edit.payload as Record<string, unknown>[]) : [];
  const label = (decision: MemberEditItemDecision) => DECISION_OPTIONS.find((o) => o.value === decision)?.short ?? decision;
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {[...reviews]
        .sort((a, b) => a.index - b.index)
        .map((r) => {
          const item = payload[r.index];
          const title = item ? viewOfItem(edit.section, item).title : '';
          return (
            <li key={r.index} className="flex flex-wrap items-start gap-2 text-sm">
              <Badge variant={DECISION_BADGE[r.decision]}>{label(r.decision)}</Badge>
              <span className="min-w-0 break-words text-ink-2">
                {title || `Entry ${r.index + 1}`}
                {r.reason && <span className="text-ink-3"> — {r.reason}</span>}
              </span>
            </li>
          );
        })}
    </ul>
  );
}

// ── Page body ────────────────────────────────────────────────────────────────────────────────

export function MemberEditsReview({ detail }: { detail: AdminMemberEditsDetailDto }) {
  const router = useRouter();
  const { member } = detail;
  const pending = detail.edits.filter((e) => e.status === 'pending');
  const reviewed = detail.edits.filter((e) => e.status !== 'pending');

  const [confirmAll, setConfirmAll] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(pending.length === 0);

  // Once the last pending edit is decided, open the history so the per-item outcomes are visible.
  useEffect(() => {
    if (pending.length === 0) setShowHistory(true);
  }, [pending.length]);

  function refresh() {
    router.refresh();
  }

  // One request per edit, in order; stops at the first failure so nothing is half-hidden.
  async function approveAll() {
    setApprovingAll(true);
    setAllError(null);
    for (const edit of pending) {
      try {
        await reviewMemberEdit(edit.id, { status: 'verified' });
      } catch (err) {
        setAllError(`${SECTION_TITLES[edit.section]}: ${errorMessage(err, 'failed to approve.')}`);
        break;
      }
    }
    setApprovingAll(false);
    setConfirmAll(false);
    refresh();
  }

  return (
    <div className="flex items-start gap-6 max-[1023px]:flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {pending.length === 0 ? (
          <Card padding="md" className="text-center">
            <p className="text-title text-ink">Nothing pending</p>
            <p className="mt-1 text-sm text-ink-3">Every change {member.name} submitted has been reviewed.</p>
          </Card>
        ) : (
          pending.map((edit) => <PendingEditCard key={edit.id} edit={edit} detail={detail} onDecided={refresh} />)
        )}

        {reviewed.length > 0 && (
          <div className="rounded-card border border-line bg-bg-card">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
            >
              <span className="text-title text-ink">Previously reviewed</span>
              <span className="text-caption text-ink-3">
                {reviewed.length} · {showHistory ? 'Hide' : 'Show'}
              </span>
            </button>
            {showHistory && (
              <ul className="divide-y divide-line border-t border-line">
                {reviewed.map((edit) => {
                  const decision = decisionOf(edit);
                  return (
                    <li key={edit.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-3.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink">{SECTION_TITLES[edit.section]}</div>
                        <div className="text-xs text-ink-3">
                          Submitted {DATE_FORMAT.format(new Date(edit.submittedAt))}
                          {edit.reviewedAt && ` · decided ${DATE_FORMAT.format(new Date(edit.reviewedAt))}`}
                        </div>
                        {edit.reviewNote && <p className="mt-1 text-sm text-ink-2">{edit.reviewNote}</p>}
                        <ItemOutcomes edit={edit} />
                      </div>
                      <Badge variant={decision.variant}>{decision.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <aside className="sticky top-24 flex w-[320px] flex-none flex-col gap-4 max-[1023px]:static max-[1023px]:order-first max-[1023px]:w-full">
        <Card padding="md">
          <div className="flex items-center gap-3">
            {member.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.photoUrl} alt="" className="h-14 w-14 flex-none rounded-xl object-cover" />
            ) : (
              <span className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-bg-alt text-lg font-semibold text-ink-2">
                {member.initials}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-title text-ink">{member.name}</div>
              {member.email && <div className="truncate text-xs text-ink-3">{member.email}</div>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {member.isVerified && <Badge variant="brand">Verified member</Badge>}
            {member.status === 'deactivated' && <Badge variant="danger">Deactivated</Badge>}
          </div>
          <Button href={`/members/${member.slug}`} variant="secondary" size="sm" fullWidth className="mt-4" target="_blank" rel="noopener noreferrer">
            View live profile ↗
          </Button>
        </Card>

        {pending.length > 0 && (
          <Card padding="md">
            <div className="text-mono-label text-ink-3">Pending changes</div>
            <div className="mt-1 text-stat text-ink">{pending.length}</div>
            <p className="mt-1 text-caption text-ink-3">
              List sections are decided entry by entry (verified, live without badge, or rejected, with a
              reason the member sees). Headline, bio and contact are approved or rejected whole.
            </p>
            {pending.length > 1 && (
              <div className="mt-4">
                {confirmAll ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-ink-2">
                      Publish all {pending.length} sections to {member.name}&apos;s live profile? List entries go
                      live with the Verified badge only where proof is attached; the rest go live without it.
                    </p>
                    <Button onClick={approveAll} disabled={approvingAll} fullWidth>
                      {approvingAll ? 'Approving…' : `Yes, approve all ${pending.length}`}
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmAll(false)} disabled={approvingAll} fullWidth>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => setConfirmAll(true)} fullWidth>
                    Approve all {pending.length}
                  </Button>
                )}
              </div>
            )}
            {allError && (
              <div className="mt-3">
                <ErrorBanner message={allError} />
              </div>
            )}
          </Card>
        )}
      </aside>
    </div>
  );
}
