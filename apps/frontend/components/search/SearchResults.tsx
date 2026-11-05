import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type {
  ArticleSearchResult,
  EventSearchResult,
  MemberSearchResult,
  SearchMatchDto,
  SearchResponse,
  SearchResult,
} from '@shared/search';
import { formatDate } from '@/lib/dates';

// How an AI search response (POST /v1/search) is shown: the composed answer, then the best matches
// grouped into members / articles / events, then "you might also need". Shared by SearchModal (live
// results) and the home page panel's demo (SearchDemo), which passes `preview` so rows are inert and
// cascade in instead of linking out.

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : formatDate(d, { utc: true });
}

const MATCH_LABEL: Record<'strong' | 'good' | 'possible', string> = {
  strong: 'Strong match',
  good: 'Good match',
  possible: 'Possible match',
};

// Shows how strong the AI judged a result (not a probability). Absent when no topic was searched.
function MatchBadge({ match }: { match?: SearchMatchDto }) {
  if (!match) return null;
  const tone =
    match.label === 'strong'
      ? 'border-ink text-ink'
      : match.label === 'good'
        ? 'border-line-2 text-ink-2'
        : 'border-line text-ink-3';
  return (
    <span className={`ml-2 flex-none whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] ${tone}`}>
      {MATCH_LABEL[match.label]}
    </span>
  );
}

// The AI judge's one-line reason this result fits the question (absent for filter-only questions).
function Reason({ text }: { text?: string }) {
  if (!text) return null;
  return <span className="mt-0.5 block text-xs leading-snug text-ink-2 line-clamp-2">{text}</span>;
}

const ROW_LAYOUT = 'flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm text-ink';

// Results open in a new tab so the answer and the other results stay on screen — closing the modal
// (or navigating away in this tab) after one click made the rest of the results unreachable.
const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' } as const;

const PREVIEW_STEP_MS = 90;

export function SearchResults({
  response,
  query,
  preview = false,
}: {
  response: SearchResponse;
  query: string;
  /** Demo mode: rows don't link anywhere and fade in one after another. */
  preview?: boolean;
}) {
  // Each block in preview mode gets the next stagger slot, top to bottom.
  let slot = 0;
  const cascade = (): { className: string; style?: CSSProperties } =>
    preview ? { className: 'sd-row', style: { animationDelay: `${slot++ * PREVIEW_STEP_MS}ms` } } : { className: '' };

  const sectionLabel = (text: string) => {
    const c = cascade();
    return (
      <div style={c.style} className={`px-2.5 py-1.5 font-mono text-[10px] text-ink-4 ${c.className}`}>
        {text}
      </div>
    );
  };

  const row = (key: string, href: string, children: ReactNode) => {
    const c = cascade();
    if (preview) {
      return (
        <div key={key} style={c.style} className={`${ROW_LAYOUT} ${c.className}`}>
          {children}
        </div>
      );
    }
    return (
      <Link key={key} href={href} className={`${ROW_LAYOUT} hover:bg-bg-alt`} {...NEW_TAB}>
        {children}
      </Link>
    );
  };

  // Results come back best-first. 'best' = strong/good; 'related' = "you might also need". When no
  // topic was searched there is no match info and everything is shown as one group.
  const best = response.results.filter((r) => r.match?.tier !== 'related');
  const related = response.results.filter((r) => r.match?.tier === 'related');

  const renderGroup = (list: SearchResult[]) => {
    const ms = list.filter((r): r is MemberSearchResult => r.type === 'member');
    const arts = list.filter((r): r is ArticleSearchResult => r.type === 'article');
    const es = list.filter((r): r is EventSearchResult => r.type === 'event');
    return (
      <>
        {ms.length > 0 && (
          <div className="mb-2">
            {sectionLabel('MEMBERS')}
            {ms.map((m) =>
              row(
                m.id,
                `/members/${m.slug}`,
                <>
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-neon text-xs font-semibold text-ink-2">
                    {initialsOf(m.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center">
                      <span className="block min-w-0 truncate font-medium">{m.name}</span>
                      <MatchBadge match={m.match} />
                    </span>
                    {(m.headline || m.location) && (
                      <span className="block truncate text-xs text-ink-3">
                        {[m.headline, m.location].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    <Reason text={m.reason} />
                  </span>
                </>
              )
            )}
          </div>
        )}

        {arts.length > 0 && (
          <div className="mb-2">
            {sectionLabel('ARTICLES')}
            {arts.map((a) =>
              row(
                a.id,
                `/articles/${a.slug}`,
                <>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center">
                      <span className="block min-w-0 truncate font-medium">{a.title}</span>
                      <MatchBadge match={a.match} />
                    </span>
                    {a.excerpt && <span className="block truncate text-xs text-ink-3">{a.excerpt}</span>}
                    <Reason text={a.reason} />
                  </span>
                </>
              )
            )}
          </div>
        )}

        {es.length > 0 && (
          <div className="mb-2">
            {sectionLabel('EVENTS')}
            {es.map((ev) =>
              row(
                ev.id,
                '/events',
                <>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center">
                      <span className="block min-w-0 truncate font-medium">{ev.title}</span>
                      <MatchBadge match={ev.match} />
                    </span>
                    <span className="block truncate text-xs text-ink-3">
                      {[formatEventDate(ev.startsAt), ev.location].filter(Boolean).join(' · ')}
                    </span>
                    <Reason text={ev.reason} />
                  </span>
                </>
              )
            )}
          </div>
        )}
      </>
    );
  };

  const answer = cascade();
  return (
    <>
      <div style={answer.style} className={`px-2.5 pb-2 pt-2 text-sm leading-relaxed text-ink-2 ${answer.className}`}>
        {response.answer}
      </div>
      {response.degraded.length > 0 && (
        <div className="px-2.5 pb-2 text-xs text-ink-3">Results may be less precise than usual right now.</div>
      )}
      {response.results.length === 0 && (
        <div className="px-2.5 pb-4 pt-2 text-sm text-ink-3">
          Nothing matched &ldquo;{query}&rdquo;. Try different wording or fewer filters.
        </div>
      )}

      {best.length > 0 && renderGroup(best)}
      {related.length > 0 && (
        <div className="mt-1 border-t border-line pt-1">
          {sectionLabel('YOU MIGHT ALSO NEED')}
          {renderGroup(related)}
        </div>
      )}
    </>
  );
}
