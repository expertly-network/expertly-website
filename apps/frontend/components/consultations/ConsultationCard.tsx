'use client';

import { useState } from 'react';
import { Badge, Button, Modal, Textarea } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ConsultationMessageThread } from '@/components/consultations/ConsultationMessageThread';
import { ConsultationRating } from '@/components/consultations/ConsultationRating';
import { updateConsultationStatus } from '@/lib/api/consultations';
import { ApiError } from '@/lib/api/client';
import type { ConsultationRequestDto, ConsultationStatus } from '@shared/consultation-request';

const REASON_MIN_LENGTH = 10;

const REASON_COPY: Record<'completed' | 'declined', { title: string; label: string; placeholder: string }> = {
  completed: {
    title: 'Mark as completed',
    label: 'How did it go?',
    placeholder: 'e.g. Spoke with them on Oct 3 — walked through the filing timeline and next steps.',
  },
  declined: {
    title: 'Decline this request',
    label: 'Reason for declining',
    placeholder: "e.g. This falls outside my practice area — referred them to a colleague who specializes in it.",
  },
};

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

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Avatar({ src, alt }: { src: string | null | undefined; alt: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="h-12 w-12 flex-none rounded-full border border-line object-cover" />;
  }
  return (
    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-line bg-bg-alt text-ink-4">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

function VerifiedBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-none text-ok" aria-label="Verified">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12.5l2.5 2.5L16 9" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ConsultationCardProps = { viewerId: string } & (
  | {
      variant: 'received';
      request: ConsultationRequestDto;
      onStatusChange: (id: string, status: 'completed' | 'declined', responseMessage: string) => void;
    }
  | { variant: 'mine'; request: ConsultationRequestDto }
);

export function ConsultationCard(props: ConsultationCardProps) {
  const { request, viewerId } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<'completed' | 'declined' | null>(null);
  const [reason, setReason] = useState('');

  async function handleConfirmReason() {
    if (props.variant !== 'received' || !reasonAction) return;
    const status = reasonAction;
    setError(null);
    setBusy(true);
    try {
      await updateConsultationStatus(request.id, status, reason.trim());
      props.onStatusChange(request.id, status, reason.trim());
      setReasonAction(null);
      setReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update this request.');
    } finally {
      setBusy(false);
    }
  }

  const isMine = props.variant === 'mine';
  const title = isMine ? (request.memberName ?? 'Member') : request.requesterName;
  const avatarSrc = isMine ? request.memberAvatarUrl : request.requesterAvatarUrl;
  const firm = isMine ? request.memberFirmName : request.requesterFirmName;
  const city = isMine ? request.memberCity : request.requesterCity;
  const country = isMine ? request.memberCountry : request.requesterCountry;
  const location = [city, country].filter(Boolean).join(', ');
  const showVerified = isMine ? false : Boolean(request.requesterIsVerifiedMember);
  const email = isMine ? undefined : request.requesterContactEmail;
  const phone = isMine ? undefined : request.requesterPhone;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-bg-card p-5 sm:flex-row">
      <Avatar src={avatarSrc} alt={title} />
      <div className="min-w-0 flex-1">
        {/* Header: who, and their standing — one line, like the member directory's own cards.
            Badge + View Profile sit side by side (not stacked) so this row stays exactly as
            tall as the name line; service + date fill the row underneath instead of being
            pushed down into the meta row, where they'd otherwise leave this area empty. */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-2">
              <span className="text-title text-ink">{title}</span>
              {showVerified && <VerifiedBadge />}
              {firm && <span className="text-caption text-ink-4">{firm}</span>}
              {firm && location && <span className="text-caption text-ink-4" aria-hidden="true">&middot;</span>}
              {location && (
                <span className="inline-flex items-center gap-1 text-caption text-ink-4">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="flex-none">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {location}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-3">
              {(request.serviceName || request.customServiceLabel) && (
                <span className="inline-flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="flex-none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {request.serviceName ?? request.customServiceLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {DATE_FORMAT.format(new Date(request.createdAt))}
              </span>
            </div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
            {props.variant === 'mine' && request.memberSlug && (
              <Button href={`/members/${request.memberSlug}`} size="sm" variant="secondary">
                View Profile
              </Button>
            )}
          </div>
        </div>

        {/* The request itself — a soft highlight (fill, no border) keeps it the clear focal
            point without adding another bordered box; a note (if any) follows as a clearly-
            attributed, lighter-weight continuation. */}
        <p className="mt-3 rounded-lg bg-bg-alt px-3.5 py-2.5 text-sm leading-relaxed text-ink">{request.message}</p>

        {request.responseMessage && (
          <p
            className={`mt-2 border-l-2 pl-3 text-sm leading-relaxed text-ink-2 ${
              request.status === 'completed' ? 'border-ok' : 'border-error'
            }`}
          >
            <span className={`font-semibold ${request.status === 'completed' ? 'text-ok' : 'text-error'}`}>
              {request.status === 'completed' ? 'Completion note — ' : 'Decline reason — '}
            </span>
            {request.responseMessage}
          </p>
        )}

        {/* Meta: direct contact only now — service/date/location all live in the header above. */}
        {(email || phone) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-caption text-ink-3">
            {email && (
              <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 hover:text-ink hover:underline">
                {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-ink hover:underline">
                {phone}
              </a>
            )}
          </div>
        )}

        {/* Actions — only the received side has any (Email/Call/Completed/Decline); the
            requester's only action, View Profile, already lives in the header above. */}
        {props.variant === 'received' && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {email && (
                <Button href={`mailto:${email}`} size="sm" variant="secondary">
                  Email
                </Button>
              )}
              {phone && (
                <Button href={`tel:${phone.replace(/[^+\d]/g, '')}`} size="sm" variant="secondary">
                  Call
                </Button>
              )}
            </div>
            {request.status === 'pending' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setReasonAction('completed')}
                  className="border-ok text-ok hover:border-ok hover:bg-ok/10"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Completed
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setReasonAction('declined')}
                  className="border-error text-error hover:border-error hover:bg-error/10"
                >
                  Decline
                </Button>
              </div>
            )}
          </div>
        )}
        {error && <div className="mt-3"><ErrorBanner message={error} /></div>}

        <ConsultationMessageThread requestId={request.id} viewerId={viewerId} locked={request.status !== 'pending'} />

        {props.variant === 'mine' && request.status !== 'pending' && (
          <ConsultationRating requestId={request.id} initialRating={request.rating} />
        )}
      </div>

      {props.variant === 'received' && reasonAction && (
        <Modal
          open
          onClose={() => {
            if (busy) return;
            setReasonAction(null);
            setReason('');
            setError(null);
          }}
          title={REASON_COPY[reasonAction].title}
        >
          <div className="flex flex-col gap-4">
            <Textarea
              label={REASON_COPY[reasonAction].label}
              placeholder={REASON_COPY[reasonAction].placeholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              autoFocus
            />
            {error && <ErrorBanner message={error} />}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setReasonAction(null);
                  setReason('');
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={busy || reason.trim().length < REASON_MIN_LENGTH}
                onClick={handleConfirmReason}
              >
                {busy ? 'Saving…' : reasonAction === 'completed' ? 'Mark completed' : 'Decline request'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
