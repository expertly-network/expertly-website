'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { ConsultationRequestDto } from '@shared/consultation-request';
import { Badge, Button } from '@/components/ui';
import { SearchBox } from '@/components/search/SearchBox';

type Row = { request: ConsultationRequestDto; kind: 'received' | 'requested' };

// Days a pending request has waited: green under a week, deep green under a month, then black.
function AgeBadge({ days }: { days: number }) {
  const tone = days < 7 ? 'bg-accent' : days < 30 ? 'bg-accent-2' : 'bg-ink';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums text-bg ${tone}`}
      title={`Waiting ${days} ${days === 1 ? 'day' : 'days'}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-bg" />
      {days} {days === 1 ? 'day' : 'days'}
    </span>
  );
}

function StatusBadge({ request }: { request: ConsultationRequestDto }) {
  if (request.status === 'pending') {
    const days = Math.max(0, Math.floor((Date.now() - Date.parse(request.createdAt)) / 86_400_000));
    return Number.isFinite(days) ? <AgeBadge days={days} /> : <Badge variant="warning">Pending</Badge>;
  }
  return request.status === 'completed' ? (
    <Badge variant="success">Completed</Badge>
  ) : (
    <Badge variant="neutral">Declined</Badge>
  );
}

// dashboard.html's "Consultation requests": received and requested in one list (tagged), a
// one-line preview and how long each pending one has waited. Hovering a row swaps the badge for
// the next step on the consultations page (on touch widths the whole row is the link) — a
// decision needs a written response, so it can't be a one-click action here. Outbox is the
// "find a member" prompt.
export function DashboardConsultations({
  received,
  sent,
}: {
  received: ConsultationRequestDto[] | null;
  sent: ConsultationRequestDto[] | null;
}) {
  const rows: Row[] = [
    ...(received ?? []).map((request) => ({ request, kind: 'received' as const })),
    ...(sent ?? []).map((request) => ({ request, kind: 'requested' as const })),
  ].sort((a, b) => Date.parse(b.request.createdAt) - Date.parse(a.request.createdAt));
  const failed = received === null || sent === null;
  const [tab, setTab] = useState<'inbox' | 'outbox'>(rows.length || failed ? 'inbox' : 'outbox');

  return (
    <section aria-label="Consultation requests">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title text-ink">Consultation requests</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Consultation view" className="flex rounded-full bg-bg-alt p-1">
            {(['inbox', 'outbox'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === value ? 'bg-ink text-bg' : 'text-ink-3 hover:text-ink'}`}
              >
                {value === 'inbox' ? 'Inbox' : 'Outbox'}
              </button>
            ))}
          </div>
          <Link href="/consultations" className="text-sm font-medium text-accent hover:underline">
            View all →
          </Link>
        </div>
      </div>

      {tab === 'inbox' ? (
        <div className="overflow-hidden rounded-card border border-line bg-bg-card">
          {received === null && sent === null ? (
            <p role="status" className="p-6 text-sm text-ink-3">
              We couldn&apos;t load your requests. Refresh to try again.
            </p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-ink-3">
              {failed
                ? 'We couldn’t load all of your requests. Refresh to try again.'
                : 'No consultation requests yet. Your public profile helps clients discover your expertise.'}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {rows.slice(0, 5).map(({ request: r, kind }) => {
                  const name = kind === 'received' ? r.requesterName : r.memberName || 'GrowXQ member';
                  const photo = kind === 'received' ? r.requesterAvatarUrl : r.memberAvatarUrl;
                  const href = kind === 'received' ? '/consultations' : '/consultations?tab=mine';
                  const canReply = kind === 'received' && r.status === 'pending';
                  return (
                    <li
                      key={`${kind}-${r.id}`}
                      className="group relative grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-4 transition-colors hover:bg-bg-alt/50 sm:px-6 md:grid-cols-[40px_minmax(0,11rem)_6.5rem_minmax(0,1fr)_auto]"
                    >
                      <span className="row-span-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-bg-alt text-sm font-medium text-ink md:row-span-1">
                        {photo ? (
                          <Image
                            src={photo}
                            unoptimized
                            alt=""
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          name.slice(0, 1)
                        )}
                      </span>
                      <Link
                        href={href}
                        className="truncate text-sm font-semibold text-ink after:absolute after:inset-0 hover:text-accent"
                      >
                        {name}
                      </Link>
                      <span className="justify-self-end md:justify-self-start">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${kind === 'received' ? 'bg-bg-alt text-ink-2' : 'border border-line-2 text-ink-3'}`}
                        >
                          {kind === 'received' ? 'Received' : 'Requested'}
                        </span>
                      </span>
                      <p className="col-start-2 truncate text-sm text-ink-3 md:col-start-auto">{r.message}</p>
                      <div className="relative z-10 col-start-3 flex items-center justify-end gap-2 md:col-start-auto">
                        <span className="md:group-focus-within:hidden md:group-hover:hidden">
                          <StatusBadge request={r} />
                        </span>
                        <span className="hidden md:group-focus-within:inline-flex md:group-hover:inline-flex">
                          <Button href={href} size="sm" variant={canReply ? 'primary' : 'secondary'}>
                            {canReply ? 'Reply' : 'Open'}
                          </Button>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {failed && (
                <p role="status" className="border-t border-line px-5 py-3 text-caption text-ink-3">
                  Some of your requests couldn&apos;t be loaded. Refresh to try again.
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-card bg-ink p-6 text-bg sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full"
            style={{
              background:
                'radial-gradient(closest-side, color-mix(in oklab, var(--accent) 30%, transparent), transparent)',
            }}
          />
          <h3 className="relative font-brand text-heading">Looking for consultation?</h3>
          <p className="relative mb-5 mt-3 max-w-xl text-sm text-white/65">
            {sent?.length
              ? `You’ve sent ${sent.length} ${sent.length === 1 ? 'request' : 'requests'}. Ask another verified GrowXQ member a question, or help a peer with theirs.`
              : 'Connect with the right GrowXQ member. Ask a verified expert a question, or help a peer with theirs.'}
          </p>
          <SearchBox
            scope="members"
            placeholder="Search by name, practice or location"
            buttonLabel="Find a member →"
            className="relative rounded-input border border-white/20 bg-white/10 p-2 focus-within:border-accent"
          />
          <Link
            href={sent?.length ? '/consultations?tab=mine' : '/members'}
            className="relative mt-4 inline-block text-sm font-medium text-accent hover:underline"
          >
            {sent?.length ? 'See your sent requests →' : 'Browse all members →'}
          </Link>
        </div>
      )}
    </section>
  );
}
