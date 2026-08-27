'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { MemberListItemDto } from '@shared/member';
import type { ArticleListItemDto } from '@shared/article';
import type { EventDto } from '@shared/event';

const MAX_RESULTS = 6;

function matchesMember(m: MemberListItemDto, q: string) {
  return (
    m.name.toLowerCase().includes(q) ||
    (m.headline ?? '').toLowerCase().includes(q) ||
    m.practiceAreas.some((p) => p.name.toLowerCase().includes(q)) ||
    (m.firmName ?? '').toLowerCase().includes(q) ||
    (m.city ?? '').toLowerCase().includes(q) ||
    m.country.toLowerCase().includes(q)
  );
}

function matchesArticle(a: ArticleListItemDto, q: string) {
  return (
    a.title.toLowerCase().includes(q) || a.practiceAreas.some((p) => p.name.toLowerCase().includes(q))
  );
}

function matchesEvent(e: EventDto, q: string) {
  return (
    e.title.toLowerCase().includes(q) ||
    (e.eventType ?? '').toLowerCase().includes(q) ||
    (e.city ?? '').toLowerCase().includes(q) ||
    (e.country ?? '').toLowerCase().includes(q)
  );
}

// Full-screen modal search overlay — matches design/static_html's `.d1-gsearch-overlay`
// pattern (centered panel, dark backdrop, Escape/backdrop-click to close). Reused by the
// homepage's AiSearchTeaser, /articles's hero search bar, and /events's hero search bar —
// each passes whatever entity lists it already fetched, not a site-wide persistent search
// (that's the roadmap-level global search feature, docs/master-tdd.md §8.3, out of scope
// here). `events` is optional since not every caller has fetched events (e.g. /articles).
export function SearchModal({
  open,
  onClose,
  members,
  articles,
  events = [],
  initialQuery = '',
}: {
  open: boolean;
  onClose: () => void;
  members: MemberListItemDto[];
  articles: ArticleListItemDto[];
  events?: EventDto[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      document.body.style.overflow = 'hidden';
      return () => {
        clearTimeout(t);
        document.body.style.overflow = '';
      };
    }
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const q = query.trim().toLowerCase();
  const memberResults = useMemo(
    () => (q ? members.filter((m) => matchesMember(m, q)).slice(0, MAX_RESULTS) : []),
    [members, q]
  );
  const articleResults = useMemo(
    () => (q ? articles.filter((a) => matchesArticle(a, q)).slice(0, MAX_RESULTS) : []),
    [articles, q]
  );
  const eventResults = useMemo(
    () => (q ? events.filter((e) => matchesEvent(e, q)).slice(0, MAX_RESULTS) : []),
    [events, q]
  );
  const hasResults = memberResults.length > 0 || articleResults.length > 0 || eventResults.length > 0;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-ink/55 px-5 pb-5 pt-[10vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search members, articles, and events"
    >
      <div
        className="flex max-h-[70vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl bg-bg-card shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-line px-[18px] py-4">
          <span aria-hidden="true" className="flex-none text-ink-3">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search members, articles, and events…"
            className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex-none rounded-md border border-line-2 bg-bg-alt px-[7px] py-[3px] font-mono text-[10.5px] font-semibold text-ink-3"
          >
            esc
          </button>
        </div>

        <div className="overflow-y-auto p-2">
          {!q && (
            <div className="flex h-[220px] items-center justify-center px-5 text-center text-sm text-ink-3">
              Start typing to search members, articles, and events.
            </div>
          )}
          {q && !hasResults && (
            <div className="flex h-[220px] items-center justify-center px-5 text-center text-sm text-ink-3">
              No matches for &ldquo;{query}&rdquo;.
            </div>
          )}
          {memberResults.length > 0 && (
            <div className="mb-2">
              <div className="px-2.5 py-1.5 font-mono text-[10px] tracking-[0.08em] text-ink-4">
                MEMBERS
              </div>
              {memberResults.map((m) => (
                <Link
                  key={m.id}
                  href={`/members/${m.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm text-ink hover:bg-bg-alt"
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full bg-neon text-xs font-semibold text-ink-2">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      m.initials
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                  {m.headline && <span className="truncate text-xs text-ink-3">{m.headline}</span>}
                </Link>
              ))}
            </div>
          )}
          {articleResults.length > 0 && (
            <div>
              <div className="px-2.5 py-1.5 font-mono text-[10px] tracking-[0.08em] text-ink-4">
                ARTICLES
              </div>
              {articleResults.map((a) => (
                <Link
                  key={a.id}
                  href={`/articles/${a.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm text-ink hover:bg-bg-alt"
                >
                  <span className="min-w-0 flex-1 truncate">{a.title}</span>
                </Link>
              ))}
            </div>
          )}
          {eventResults.length > 0 && (
            <div>
              <div className="px-2.5 py-1.5 font-mono text-[10px] tracking-[0.08em] text-ink-4">
                EVENTS
              </div>
              {eventResults.map((e) => (
                <Link
                  key={e.id}
                  href="/events"
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm text-ink hover:bg-bg-alt"
                >
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  {e.city && <span className="truncate text-xs text-ink-3">{e.city}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between border-t border-line px-[18px] py-2.5 text-[11px] text-ink-3">
          <div className="flex gap-3">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
          <span>Powered by Expertly</span>
        </div>
      </div>
    </div>
  );
}
