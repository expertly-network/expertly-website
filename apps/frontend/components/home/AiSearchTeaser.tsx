'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchBox } from '@/components/search/SearchBox';
import { SearchModal } from '@/components/home/SearchModal';
import { DEMO_SCENARIOS, SearchDemoBody, useSearchDemo } from '@/components/home/SearchDemo';

// The panel's top row is a real search input: type, press Enter, and the AI search modal opens
// with the results (POST /v1/search). "Try GrowXQ" opens that same modal directly, empty and ready
// to type in, just like the floating island bar at the bottom of the page does.
// While idle, the panel plays a sample search (SearchDemo). It pauses as soon as the visitor
// focuses or types in the input, and while the panel is off-screen.
export function AiSearchTeaser() {
  const [searchOpen, setSearchOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [hasText, setHasText] = useState(false);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const engaged = focused || hasText;
  const { index, scenario, typed, stage } = useSearchDemo(engaged || !inView, reducedMotion);
  const placeholder = engaged
    ? DEMO_SCENARIOS[0].query
    : scenario.query.slice(0, typed) + (stage === 'typing' && !reducedMotion ? '|' : '');

  return (
    <section className="border-b border-line bg-bg-alt py-10 sm:py-24">
      <PageContainer className="grid gap-6 sm:gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>GrowXQ · Intelligent Discovery</Eyebrow>
          <h2 className="font-brand mt-4 text-section-title text-ink">
            Ask in plain English. Get <span className="text-accent">exactly</span> who &amp; what you need.
          </h2>
          <p className="mt-4 max-w-[480px] text-lede text-ink-3 sm:mt-5">
            One query searches the entire network at once, no filters to fiddle with, no jargon required. Describe the
            matter and GrowXQ search surfaces the right people, the relevant reading, and the events worth your time.
          </p>
          {/* The three result types are visible in the demo panel right below on phones. */}
          <ul className="mt-6 hidden flex-col gap-3 text-[15px] text-ink-3 sm:flex">
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
                ✓
              </span>
              <span>
                <span className="font-medium text-ink">Verified experts</span>, matched by practice, jurisdiction &amp;
                rate
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
                ✓
              </span>
              <span>
                <span className="font-medium text-ink">Articles &amp; insights</span>, peer-reviewed analysis on point
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
                ✓
              </span>
              <span>
                <span className="font-medium text-ink">Upcoming events</span>, conferences and meetings that fit
              </span>
            </li>
          </ul>
          <Button type="button" onClick={() => setSearchOpen(true)} className="mt-6 sm:mt-8">
            Try GrowXQ →
          </Button>
        </div>

        <div
          ref={panelRef}
          className="min-w-0"
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={() => setFocused(false)}
        >
          <Card padding="md" className="!p-0 transition-shadow focus-within:shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
            <SearchBox
              placeholder={placeholder}
              demo={!engaged}
              onTextChange={(t) => setHasText(t.trim().length > 0)}
              buttonLabel="Search"
              leading={
                <span aria-hidden="true" className="flex-none text-accent">
                  ⌕
                </span>
              }
              className="border-b border-line py-3 pl-5 pr-3"
            />
            <div className="relative h-[320px] sm:h-[400px]">
              {engaged ? (
                <div className="flex h-full items-center justify-center px-5 text-center text-xs text-ink-3">
                  Type a question and press Enter. Results open with an answer in a few seconds.
                </div>
              ) : (
                <SearchDemoBody index={index} scenario={scenario} stage={stage} />
              )}
            </div>
            <div className="flex items-center justify-end border-t border-line px-5 py-3 text-[11px] text-ink-3 sm:justify-between">
              <span className="hidden sm:inline">
                {engaged ? '↵ search · esc close' : 'Example search · type your own above'}
              </span>
              <span>Powered by GrowXQ</span>
            </div>
          </Card>
        </div>
      </PageContainer>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </section>
  );
}
