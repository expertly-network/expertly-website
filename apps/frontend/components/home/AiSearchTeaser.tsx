'use client';

import { useRef } from 'react';
import { Button, Card, Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchBox } from '@/components/search/SearchBox';

// The panel's top row is a real search input: type, press Enter, and the AI search modal opens
// with the results (POST /v1/search). "Try GrowXQ" just moves the cursor into that input.
export function AiSearchTeaser() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="border-b border-line bg-bg-alt py-24">
      <PageContainer className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>GrowXQ · Intelligent Discovery</Eyebrow>
          <h2 className="mt-4 text-section-title text-ink">
            Ask in plain English. Get <span className="text-accent">exactly</span> who &amp; what you need.
          </h2>
          <p className="mt-5 max-w-[480px] text-lede text-ink-3">
            One query searches the entire network at once, no filters to fiddle with, no jargon required. Describe the
            matter and GrowXQ search surfaces the right people, the relevant reading, and the events worth your time.
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
          <Button type="button" onClick={() => inputRef.current?.focus()} className="mt-8">
            Try GrowXQ →
          </Button>
        </div>

        <Card padding="md" className="!p-0 transition-shadow focus-within:shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
          <SearchBox
            inputRef={inputRef}
            placeholder="M&A tax advisor in Singapore under $500/hr"
            buttonLabel="Search"
            leading={
              <span aria-hidden="true" className="flex-none text-accent">
                ⌕
              </span>
            }
            className="border-b border-line py-3 pl-5 pr-3"
          />
          <div className="flex h-[220px] items-center justify-center px-5 text-center text-xs text-ink-3">
            Type a question and press Enter. Results open with an answer in a few seconds.
          </div>
          <div className="flex items-center justify-end border-t border-line px-5 py-3 text-[11px] text-ink-3 sm:justify-between">
            <span className="hidden sm:inline">↵ search · esc close</span>
            <span>Powered by GrowXQ</span>
          </div>
        </Card>
      </PageContainer>
    </section>
  );
}
