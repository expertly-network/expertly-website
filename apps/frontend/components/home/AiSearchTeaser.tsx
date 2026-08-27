'use client';

import { useState } from 'react';
import { Button, Card, Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchModal } from '@/components/home/SearchModal';
import type { MemberListItemDto } from '@shared/member';
import type { ArticleListItemDto } from '@shared/article';

// Real cross-entity search is 📋 roadmap with no backend (docs/master-tdd.md §8.3) — this
// panel itself is a static preview (matching the design's own demo-box look), but clicking
// it opens a genuinely-functional full-screen search modal (SearchModal) over the members/
// articles the homepage already fetched — matches design/static_html's `.d1-gsearch-overlay`
// click-to-open pattern, not an inline-filtering box.
export function AiSearchTeaser({
  members,
  articles,
}: {
  members: MemberListItemDto[];
  articles: ArticleListItemDto[];
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="border-b border-line bg-bg-alt py-24">
      <PageContainer className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>Expertly · Intelligent Discovery</Eyebrow>
          <h2 className="mt-4 text-section-title text-ink">
            Ask in plain English. Get <span className="text-accent">exactly</span> who &amp; what
            you need.
          </h2>
          <p className="mt-5 max-w-[480px] text-lede text-ink-3">
            One query searches the entire network at once, no filters to fiddle with, no jargon
            required. Describe the matter and Expertly search surfaces the right people, the
            relevant reading, and the events worth your time.
          </p>
          <ul className="mt-6 flex flex-col gap-3 text-[15px] text-ink-2">
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
                ✓
              </span>
              <span>
                <strong>Verified experts</strong>, matched by practice, jurisdiction &amp; rate
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
                ✓
              </span>
              <span>
                <strong>Articles &amp; insights</strong>, peer-reviewed analysis on point
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
                ✓
              </span>
              <span>
                <strong>Upcoming events</strong>, conferences and meetings that fit
              </span>
            </li>
          </ul>
          <Button type="button" onClick={() => setModalOpen(true)} className="mt-8">
            Try Expertly →
          </Button>
        </div>

        <button type="button" onClick={() => setModalOpen(true)} className="block w-full text-left">
          <Card padding="md" className="!p-0 transition-shadow hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
              <span aria-hidden="true" className="text-accent">
                ⌕
              </span>
              <span className="flex-1 text-[15px] text-ink-3">
                M&amp;A tax advisor in Singapore under $500/hr
              </span>
              <span className="rounded-full border border-line-2 bg-bg-alt px-2 py-1 text-[10px] font-medium text-ink-3">
                Click to search
              </span>
            </div>
            <div className="flex h-[220px] items-center justify-center px-5 text-center text-xs text-ink-3">
              Click to search real members and articles.
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[11px] text-ink-3">
              <span>↑↓ navigate · ↵ open · esc close</span>
              <span>Powered by Expertly</span>
            </div>
          </Card>
        </button>
      </PageContainer>

      <SearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        members={members}
        articles={articles}
      />
    </section>
  );
}
