'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import { searchDirectory, sendSearchFeedback } from '@/lib/api/search';
import { createClient } from '@/lib/supabase/client';
import type { SearchResponse, SearchScope } from '@shared/search';
import { SearchResults } from '@/components/search/SearchResults';

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 500;

type Status = 'idle' | 'loading' | 'done' | 'error';
type Feedback = 'none' | 'sending' | 'sent' | 'failed';

const PLACEHOLDER: Record<SearchScope, string> = {
  all: 'Ask anything — e.g. transfer pricing experts in Singapore',
  members: 'Ask about experts — e.g. transfer pricing in Singapore',
  articles: 'Ask about articles — e.g. GST input tax credit',
  events: 'Ask about events — e.g. tax conferences in Dubai',
};

// AI search over members, articles and events (POST /v1/search, signed-in only). Searches only on
// Enter / the button — never per keystroke, since each question is two AI calls and takes seconds.
// Opened by SearchBox (components/search/SearchBox.tsx) with the question the user already typed:
// `initialQuery` runs immediately on open. `scope` narrows results to one type (articles / events
// pages); the input stays editable for follow-up questions.
export function SearchModal({
  open,
  onClose,
  initialQuery = '',
  scope = 'all',
}: {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  scope?: SearchScope;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>('none');
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setQuery('');
    setStatus('idle');
    setResponse(null);
    setErrorMessage('');
    setWaitSeconds(0);
    setFeedback('none');
  }, []);

  // On open: reset to the question typed in the SearchBox, check the (locally stored) session so
  // guests get the sign-in prompt instead of a doomed request, then run that question straight
  // away. Locks page scroll and focuses the input. On close: cancel any in-flight request.
  useEffect(() => {
    if (!open) return;
    reset();
    const first = initialQuery.trim();
    setQuery(first);
    let cancelled = false;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (cancelled) return;
        const hasSession = Boolean(data.session);
        setSignedIn(hasSession);
        if (hasSession && first.length >= MIN_QUERY_LENGTH) void runSearch(first);
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    document.body.style.overflow = 'hidden';
    return () => {
      cancelled = true;
      clearTimeout(t);
      abortRef.current?.abort();
      document.body.style.overflow = '';
    };
    // runSearch is intentionally not a dependency: this runs once per open, with that open's question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset, initialQuery]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Countdown after a 429.
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const t = setTimeout(() => setWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [waitSeconds]);

  const trimmed = query.trim();
  const canSubmit =
    signedIn === true && status !== 'loading' && waitSeconds === 0 && trimmed.length >= MIN_QUERY_LENGTH;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    void runSearch(trimmed);
  }

  async function runSearch(question: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setResponse(null);
    setErrorMessage('');
    setFeedback('none');
    try {
      const result = await searchDirectory({ query: question, scope }, controller.signal);
      if (controller.signal.aborted) return;
      setResponse(result);
      setStatus('done');
    } catch (err) {
      if (controller.signal.aborted) return;
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === 'SESSION_MISSING' || code === 'SESSION_INVALID') {
        setSignedIn(false);
        setStatus('idle');
        return;
      }
      if (err instanceof ApiError && code === 'RATE_LIMITED') {
        const seconds = err.retryAfterSeconds ?? 30;
        setWaitSeconds(seconds);
        setErrorMessage(`You're searching a little fast. Please wait ${seconds} seconds and try again.`);
      } else {
        setErrorMessage(
          apiErrorMessage(err, 'Search is unavailable right now. Please try again in a moment.', {
            SEARCH_QUERY_LENGTH: 'Please ask a question between 2 and 500 characters.',
            VALIDATION_FAILED: 'That search couldn’t be run. Please rephrase your question and try again.',
          })
        );
      }
      setStatus('error');
    }
  }

  async function rate(rating: 1 | -1) {
    if (!response?.logId || feedback === 'sending' || feedback === 'sent') return;
    setFeedback('sending');
    try {
      await sendSearchFeedback({ logId: response.logId, rating });
      setFeedback('sent');
    } catch {
      setFeedback('failed');
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-ink/55 px-4 pb-5 pt-[8vh] sm:px-5 sm:pt-[10vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search members, articles, and events"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl bg-bg-card shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={submit}
          className="flex flex-shrink-0 items-center gap-2.5 border-b border-line px-4 py-3 focus-within:shadow-[inset_0_-2px_0_var(--accent)] sm:px-[18px] sm:py-4"
        >
          <span aria-hidden="true" className="flex-none text-ink-3">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            maxLength={MAX_QUERY_LENGTH}
            disabled={signedIn === false}
            placeholder={PLACEHOLDER[scope]}
            aria-label="Your question"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-none rounded-md bg-ink px-3 py-2 text-xs font-medium text-bg transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === 'loading' ? 'Searching…' : 'Search'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="hidden flex-none rounded-md border border-line-2 bg-bg-alt px-[7px] py-[3px] font-mono text-[10.5px] font-semibold text-ink-3 sm:block"
          >
            esc
          </button>
        </form>

        <div className="overflow-y-auto p-2" aria-live="polite" aria-busy={status === 'loading'}>
          {signedIn === false && (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 px-5 py-6 text-center">
              <p className="max-w-[360px] text-sm text-ink-2">
                Sign in to ask questions across members, articles and events.
              </p>
              <Link
                href={`/login?returnTo=${encodeURIComponent(pathname || '/')}`}
                onClick={onClose}
                className="inline-flex min-h-[44px] items-center justify-center rounded-input bg-ink px-6 text-sm font-medium text-bg transition-colors hover:bg-ink-2"
              >
                Sign in to search
              </Link>
            </div>
          )}

          {signedIn !== false && status === 'idle' && (
            <div className="flex min-h-[220px] items-center justify-center px-5 text-center text-sm text-ink-3">
              Ask in plain English and press Enter. Searching takes a few seconds.
            </div>
          )}

          {status === 'loading' && (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-5 text-center text-sm text-ink-3">
              <span
                aria-hidden="true"
                className="h-5 w-5 animate-spin rounded-full border-2 border-line-2 border-t-accent"
              />
              Searching the network…
            </div>
          )}

          {status === 'error' && (
            <div
              role="alert"
              className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-5 text-center text-sm text-ink-2"
            >
              <p>{errorMessage}</p>
              {waitSeconds > 0 && <p className="font-mono text-xs text-ink-3">Try again in {waitSeconds}s</p>}
            </div>
          )}

          {status === 'done' && response && (
            <>
              <SearchResults response={response} query={trimmed} />

              {response.logId && (
                <div className="flex flex-wrap items-center gap-2 border-t border-line px-2.5 pb-1 pt-3 text-xs text-ink-3">
                  {feedback === 'sent' ? (
                    <span>Thanks for the feedback.</span>
                  ) : (
                    <>
                      <span>Was this helpful?</span>
                      <button
                        type="button"
                        onClick={() => rate(1)}
                        disabled={feedback === 'sending'}
                        className="min-h-[36px] rounded-md border border-line-2 px-3 text-ink-2 transition-colors hover:border-ink disabled:opacity-40"
                      >
                        Helpful
                      </button>
                      <button
                        type="button"
                        onClick={() => rate(-1)}
                        disabled={feedback === 'sending'}
                        className="min-h-[36px] rounded-md border border-line-2 px-3 text-ink-2 transition-colors hover:border-ink disabled:opacity-40"
                      >
                        Not helpful
                      </button>
                      {feedback === 'failed' && <span>Couldn&apos;t send that — try again.</span>}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center justify-end border-t border-line px-4 py-2.5 text-[11px] text-ink-3 sm:justify-between sm:px-[18px]">
          <div className="hidden gap-3 sm:flex">
            <span>↵ search</span>
            <span>results open in a new tab</span>
            <span>esc close</span>
          </div>
          <span>Powered by GrowXQ</span>
        </div>
      </div>
    </div>
  );
}
