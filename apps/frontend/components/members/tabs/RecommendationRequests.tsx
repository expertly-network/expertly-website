'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Textarea } from '@/components/ui';
import {
  createRecommendationRequest,
  getMyRecommendationRequests,
  updateRecommendationRequest,
} from '@/lib/api/recommendation-requests';
import { getMembers } from '@/lib/api/members';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import type { MemberListItemDto } from '@shared/member';
import type { RecommendationRequestDto } from '@shared/recommendation-request';

// The backend's error codes (recommendation-requests.service.ts) → a specific message for each.
const ASK_ERRORS: Record<string, string> = {
  RECOMMENDATION_REQUEST_SELF: 'You can’t ask yourself for a recommendation.',
  RECOMMENDATION_AUTHOR_NOT_ACTIVE_MEMBER: 'Only active members can request recommendations.',
  MEMBER_NOT_FOUND: 'This member can no longer be asked.',
  RECOMMENDATION_REQUEST_PENDING: 'You have already asked this member.',
  RECOMMENDATION_ALREADY_GIVEN: 'This member has already recommended you.',
  RECOMMENDATION_REQUEST_COOLDOWN: 'You can ask this member again 30 days after your last request.',
  RECOMMENDATION_REQUEST_LIMIT: 'You already have 10 requests open. Cancel one to ask someone else.',
};

const MAX_MESSAGE = 500;

/** Asks one known member for a recommendation: an optional note, then Send. */
function AskForm({
  memberId,
  memberName,
  onDone,
  onCancel,
}: {
  memberId: string;
  memberName: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      await createRecommendationRequest(memberId, { message: message.trim() || undefined });
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send your request. Please try again.', ASK_ERRORS));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-line bg-bg-alt p-4">
      <Textarea
        label={`Message to ${memberName} (optional)`}
        rows={3}
        maxLength={MAX_MESSAGE}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="We worked together on the Acme restructuring — would you share a few words about it?"
        hint="They get an email with your request."
        error={error ?? undefined}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={send} disabled={sending}>
          {sending ? 'Sending…' : 'Send request'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** On another member's profile: "Ask <name> to recommend you". */
export function RequestRecommendationButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <p role="status" className="mt-4 text-profile-item text-ink-3">
        Request sent — {memberName} has been emailed.
      </p>
    );
  }
  return (
    <div className="mt-4">
      {!open && (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Ask {memberName} to recommend you
        </Button>
      )}
      {open && (
        <AskForm
          memberId={memberId}
          memberName={memberName}
          onDone={() => setSent(true)}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** On the owner's own profile: who asked me, who I asked, and a search to ask someone new. */
export function OwnRecommendationRequests() {
  const [received, setReceived] = useState<RecommendationRequestDto[]>([]);
  const [sent, setSent] = useState<RecommendationRequestDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberListItemDto[]>([]);
  const [picked, setPicked] = useState<MemberListItemDto | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([getMyRecommendationRequests('received'), getMyRecommendationRequests('sent')]);
      setReceived(r);
      setSent(s);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your recommendation requests.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A small debounce so typing a name doesn't fire a request per keystroke.
  useEffect(() => {
    const q = query.trim();
    if (!searching || q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      getMembers({ q, serviceId: [], country: [], sort: 'featured', pageSize: 6 })
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, searching]);

  async function act(requestId: string, action: 'ignore' | 'cancel') {
    setBusyId(requestId);
    setError(null);
    try {
      await updateRecommendationRequest(requestId, action);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update that request.'));
    } finally {
      setBusyId(null);
    }
  }

  const sentOpen = sent.filter((r) => r.status === 'pending');
  const sentDone = sent.filter((r) => r.status === 'fulfilled');

  return (
    <div className="mb-5 flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-caption text-red-600">
          {error}
        </p>
      )}

      {received.length > 0 && (
        <div>
          <h4 className="mb-2 text-profile-item font-semibold text-ink">Asked to recommend ({received.length})</h4>
          <ul className="flex flex-col gap-2">
            {received.map((r) => (
              <li key={r.id} className="rounded-2xl border border-line bg-bg-card px-4 py-3">
                <p className="text-profile-item text-ink-2">
                  <Link href={`/members/${r.requester.slug}`} className="font-semibold text-ink hover:underline">
                    {r.requester.name}
                  </Link>{' '}
                  asked you for a recommendation.
                </p>
                {r.message && <p className="mt-1 text-caption text-ink-3">“{r.message}”</p>}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" href={`/members/${r.requester.slug}?tab=reviews#member-recommendations-heading`}>
                    Write a recommendation
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => act(r.id, 'ignore')}>
                    Ignore
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-profile-item font-semibold text-ink">Ask for a recommendation</h4>
          {!searching && (
            <Button variant="secondary" size="sm" onClick={() => setSearching(true)}>
              Ask a member
            </Button>
          )}
        </div>
        {searching && !picked && (
          <div className="mt-2">
            <Input
              label="Find a member"
              placeholder="Start typing a name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {results.length > 0 && (
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-bg-card">
                {results.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(m)}
                      className="flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-bg-alt"
                    >
                      <span className="text-profile-item font-semibold text-ink">{m.name}</span>
                      {m.headline && <span className="truncate text-caption text-ink-3">{m.headline}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => {
                setSearching(false);
                setQuery('');
              }}
              className="mt-2 text-caption font-medium text-ink-3 underline"
            >
              Cancel
            </button>
          </div>
        )}
        {picked && (
          <AskForm
            memberId={picked.id}
            memberName={picked.name}
            onCancel={() => setPicked(null)}
            onDone={() => {
              setPicked(null);
              setSearching(false);
              setQuery('');
              void load();
            }}
          />
        )}
      </div>

      {sent.length > 0 && (
        <div>
          <h4 className="mb-2 text-profile-item font-semibold text-ink">Your requests</h4>
          <ul className="flex flex-col gap-1.5">
            {[...sentOpen, ...sentDone].map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg-alt px-4 py-2.5 text-profile-item"
              >
                <Link href={`/members/${r.recipient.slug}`} className="font-medium text-ink hover:underline">
                  {r.recipient.name}
                </Link>
                {r.status === 'fulfilled' ? (
                  <span className="text-caption font-semibold text-accent">Recommended you</span>
                ) : (
                  <span className="flex items-center gap-3">
                    <span className="text-caption text-ink-3">Requested</span>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, 'cancel')}
                      className="text-caption font-medium text-ink-3 underline disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
