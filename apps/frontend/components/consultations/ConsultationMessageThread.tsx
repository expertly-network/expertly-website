'use client';

import { useState } from 'react';
import { Button, Textarea } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { listConsultationMessages, postConsultationMessage } from '@/lib/api/consultations';
import { ApiError } from '@/lib/api/client';
import type { ConsultationMessageDto } from '@shared/consultation-request';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// Lazy-loaded, collapsible back-and-forth thread on a consultation request. Either participant
// (requester or member) can read/post while the request is pending; once decided, `locked` hides
// the composer (history stays readable) and the requester rates the conversation instead.
export function ConsultationMessageThread({
  requestId,
  viewerId,
  locked,
}: {
  requestId: string;
  viewerId: string;
  locked: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ConsultationMessageDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  async function handleToggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (messages !== null) return;
    setLoading(true);
    setError(null);
    try {
      setMessages(await listConsultationMessages(requestId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const sent = await postConsultationMessage(requestId, body);
      setMessages((prev) => [...(prev ?? []), sent]);
      setDraft('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-caption font-medium text-ink-2 hover:text-ink"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        {expanded ? 'Hide conversation' : 'View conversation'}
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3">
          {loading && <p className="text-caption text-ink-3">Loading…</p>}
          {!loading && messages && messages.length === 0 && (
            <p className="text-caption text-ink-3">No messages yet — say hello.</p>
          )}
          {!loading && messages && messages.length > 0 && (
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {messages.map((m) => {
                const mine = m.senderId === viewerId;
                return (
                  <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm ${
                        mine ? 'bg-ink text-bg' : 'border border-line bg-bg-alt text-ink-2'
                      }`}
                    >
                      {m.body}
                    </div>
                    <span className="mt-1 text-[11px] text-ink-4">
                      {mine ? 'You' : m.senderName} &middot; {DATE_FORMAT.format(new Date(m.createdAt))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {error && <ErrorBanner message={error} />}

          {locked ? (
            <p className="text-caption text-ink-3">
              This conversation has ended — the request has been decided.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Textarea
                label=""
                aria-label="Write a message…"
                placeholder="Write a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
              />
              <Button size="sm" className="self-end" disabled={sending || draft.trim().length === 0} onClick={handleSend}>
                {sending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
