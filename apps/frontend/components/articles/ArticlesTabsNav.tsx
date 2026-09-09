import Link from 'next/link';
import { WriteArticleCtaButton } from '@/components/articles/WriteArticleCtaButton';

export type ArticlesTab = 'browse' | 'mine';

const TAB_CLASSES = (isActive: boolean) =>
  `-mb-px flex items-center gap-[7px] border-b-2 pb-3.5 text-[14.5px] font-medium transition-colors ${
    isActive ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-4 hover:text-ink-2'
  }`;

// Matches design/static_html/articles.html's `#anv-tab-row` — persistent chrome shown above
// every panel of the articles experience (browse, my articles, AND the write flow all sit below
// this same row in the prototype's single page). Two modes:
// - `onTabChange` provided (the /articles page itself): tabs are buttons that swap a client-side
//   panel, per ArticlesTabsSection.
// - `onTabChange` omitted (e.g. /articles/write, a separate Next.js route): tabs are plain links
//   back to /articles, so the header still renders there without needing the panel-swap state.
//   Neither tab shows "active" on that page — write isn't one of the two tab panels.
export function ArticlesTabsNav({
  canWrite,
  active,
  onTabChange,
}: {
  canWrite: boolean;
  active: ArticlesTab | null;
  onTabChange?: (tab: ArticlesTab) => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:gap-3">
      <div className="flex gap-7">
        {onTabChange ? (
          <>
            <button type="button" onClick={() => onTabChange('browse')} className={TAB_CLASSES(active === 'browse')}>
              Browse Articles
            </button>
            {canWrite && (
              <button type="button" onClick={() => onTabChange('mine')} className={TAB_CLASSES(active === 'mine')}>
                My Articles
              </button>
            )}
          </>
        ) : (
          <>
            <Link href="/articles" className={TAB_CLASSES(active === 'browse')}>
              Browse Articles
            </Link>
            {canWrite && (
              <Link href="/articles?tab=mine" className={TAB_CLASSES(active === 'mine')}>
                My Articles
              </Link>
            )}
          </>
        )}
      </div>
      {canWrite && <WriteArticleCtaButton className="mb-2.5 flex-none" />}
    </div>
  );
}
