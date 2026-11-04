'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { ConsultationRequestDto } from '@shared/consultation-request';
import { Badge, Button } from '@/components/ui';
import { SearchBox } from '@/components/search/SearchBox';
import { formatDate } from '@/lib/dates';

export function DashboardConsultations({
  received,
  sent,
}: {
  received: ConsultationRequestDto[] | null;
  sent: ConsultationRequestDto[] | null;
}) {
  const [tab, setTab] = useState<'inbox' | 'outbox'>('inbox');
  const requests = tab === 'inbox' ? received : sent;
  const href = tab === 'inbox' ? '/consultations' : '/consultations?tab=mine';
  return (
    <section aria-label="Consultation requests">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title text-ink">Consultation requests</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Consultation view"
            className="flex rounded-full border border-line bg-bg-card p-1"
          >
            {(['inbox', 'outbox'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${tab === value ? 'bg-ink text-bg' : 'text-ink-3 hover:text-ink'}`}
              >
                {value === 'inbox' ? 'Inbox' : 'Outbox'}
              </button>
            ))}
          </div>
          <Link href={href} className="text-sm font-medium text-accent hover:underline">
            View all →
          </Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-bg-card">
        {requests === null ? (
          <p role="status" className="p-6 text-sm text-ink-3">
            We couldn&apos;t load your requests. Refresh to try again.
          </p>
        ) : requests.length === 0 ? (
          <p className="p-6 text-sm text-ink-3">
            {tab === 'inbox'
              ? 'No requests received yet. Your public profile helps clients discover your expertise.'
              : 'You haven’t sent a consultation request yet. Find a member below to get started.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {[...requests]
              .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
              .slice(0, 5)
              .map((r) => {
                const name = tab === 'inbox' ? r.requesterName : r.memberName || 'GrowXQ member';
                const photo = tab === 'inbox' ? r.requesterAvatarUrl : r.memberAvatarUrl;
                const days = Math.max(0, Math.floor((Date.now() - Date.parse(r.createdAt)) / 86_400_000));
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neon text-sm text-ink">
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
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={href} className="text-sm font-semibold text-ink hover:text-accent">
                          {name}
                        </Link>
                        <Badge variant="neutral">{tab === 'inbox' ? 'Received' : 'Requested'}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-3">{r.message}</p>
                      <p className="mt-1 text-caption text-ink-4">{formatDate(r.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 max-sm:ml-[52px]">
                      <Badge
                        variant={r.status === 'pending' ? 'warning' : r.status === 'completed' ? 'success' : 'neutral'}
                      >
                        {r.status === 'pending' ? 'Pending' : r.status === 'completed' ? 'Completed' : 'Declined'}
                      </Badge>
                      {r.status === 'pending' && Number.isFinite(days) && (
                        <span className="text-caption text-ink-3">
                          {days} {days === 1 ? 'day' : 'days'}
                        </span>
                      )}
                      <Button href={href} size="sm" variant="secondary">
                        {tab === 'inbox' && r.status === 'pending' ? 'Reply' : 'Open'}
                      </Button>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
      {tab === 'outbox' && (
        <div className="mt-4 rounded-card bg-ink p-6 text-bg-card sm:p-8">
          <h3 className="font-brand text-heading">Looking for consultation?</h3>
          <p className="mb-5 mt-3 text-sm text-white/65">
            Connect with the right GrowXQ member. Ask a verified expert a question, or help a peer with theirs.
          </p>
          <SearchBox
            scope="members"
            placeholder="Search by name, practice or location"
            buttonLabel="Find a member →"
            className="rounded-input border border-white/20 bg-white/10 p-2 focus-within:border-accent"
          />
          <Link href="/members" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
            Browse all members →
          </Link>
        </div>
      )}
    </section>
  );
}
