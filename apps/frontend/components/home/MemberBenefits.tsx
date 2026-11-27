'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { VerticalsOrbit } from '@/components/home/VerticalsOrbit';
import { STICKY_UNDER_MOBILE_BAR } from '@/lib/ui/mobile';
import type { Vertical } from '@/components/home/verticals-data';

// The six member benefits around the dial. The section pins while you scroll through it: the dial
// turns from one benefit to the next and the panel shows the one at the top (beside the dial on
// large screens, under a smaller dial on phones). Short, wide screens (a zoomed-in laptop, a tablet or
// phone held sideways) get the side-by-side layout too: stacked, the dial would shrink to nothing.
// Clicking or tapping a benefit scrolls to it.
// Phones keep the bottom clear (pb-20) for the floating search button.
// The pinned screen is sized in svh, not dvh: on phones dvh changes as the browser's address bar
// hides and returns while scrolling, which resized the dial on every scroll direction change.
// Phones: the dial gets most of the screen (edge to edge, every pixel the title and panel leave) and
// the panel at the bottom is just the benefit's number, title and status.

const HOLD = 0.04; // share of the scroll held on the first and last benefit

export function MemberBenefits({ benefits }: { benefits: readonly Vertical[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const litRef = useRef(0);
  const [active, setActive] = useState(-1);
  const [visible, setVisible] = useState(false);
  const last = benefits.length - 1;

  // Scroll geometry: where the pinned part sticks and how far the section scrolls while pinned.
  const geometry = useCallback(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    if (!section || !pin) return null;
    const stickyTop = parseFloat(getComputedStyle(pin).top) || 0;
    const travel = Math.max(1, section.offsetHeight - pin.offsetHeight);
    return { section, stickyTop, travel };
  }, []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const g = geometry();
      if (!g) return;
      const top = g.section.getBoundingClientRect().top;
      const progress = Math.min(1, Math.max(0, (g.stickyTop - top) / g.travel));
      const pos = Math.min(1, Math.max(0, (progress - HOLD) / (1 - 2 * HOLD))) * last;
      // The dial lights up over the last stretch before the section pins.
      const lit = Math.min(1, Math.max(0, 1 - (top - g.stickyTop) / (window.innerHeight * 0.5)));
      posRef.current = pos;
      litRef.current = lit;
      const next = lit > 0.5 ? Math.round(pos) : -1;
      setActive((a) => (a === next ? a : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '200px 0px' });
    if (sectionRef.current) io.observe(sectionRef.current);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [geometry, last]);

  const goTo = useCallback(
    (i: number) => {
      const g = geometry();
      if (!g) return;
      const progress = HOLD + (1 - 2 * HOLD) * (i / last);
      const sectionTop = g.section.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: sectionTop - g.stickyTop + progress * g.travel + 1, behavior: 'smooth' });
    },
    [geometry, last]
  );

  const shown = Math.max(0, active);

  return (
    <section ref={sectionRef} aria-labelledby="layers-title" className="relative h-[320vh] bg-ink lg:h-[300vh]">
      <div
        ref={pinRef}
        className={`sticky ${STICKY_UNDER_MOBILE_BAR} flex h-[calc(100svh-61px)] flex-col justify-center overflow-hidden pb-20 pt-6 max-sm:pt-4 [@media(max-height:700px)]:pt-3 sm:max-lg:landscape:pb-14 sm:max-lg:landscape:pt-3 lg:top-0 lg:h-dvh lg:justify-start lg:pb-16 lg:pt-8`}
      >
        <PageContainer className="grid w-full grid-rows-[auto_auto_auto] content-center gap-5 max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:gap-4 [@media(max-height:700px)]:gap-3 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:min-h-0 lg:flex-1 lg:grid-rows-[auto_minmax(0,1fr)] lg:content-stretch lg:gap-x-14 lg:gap-y-6 sm:max-lg:landscape:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:max-lg:landscape:grid-rows-[auto_auto] sm:max-lg:landscape:gap-x-8 sm:max-lg:landscape:gap-y-4">
          <div className="text-center lg:col-span-2 lg:row-start-1 sm:max-lg:landscape:col-start-1 sm:max-lg:landscape:row-start-1 sm:max-lg:landscape:self-end sm:max-lg:landscape:text-left">
            <Eyebrow dark>For members</Eyebrow>
            <h2
              id="layers-title"
              className="font-brand mt-3 scroll-mt-24 max-sm:mt-2 text-heading text-bg lg:text-headline"
            >
              Ways we help <span className="text-accent">our members grow</span>.
            </h2>
          </div>

          {/* The dial. Phones: this row takes all the height the title and the panel leave, and the
              dial fills it (edge to edge across the screen, as tall as the row allows) via container units. */}
          <div className="flex items-center justify-center max-sm:-mx-5 max-sm:min-h-0 max-sm:flex-1 max-sm:[container-type:size] lg:col-start-2 lg:row-start-2 sm:max-lg:landscape:col-start-2 sm:max-lg:landscape:row-span-2 sm:max-lg:landscape:row-start-1">
            <div
              role="group"
              aria-label={`The six member benefits. Showing ${benefits[shown].title}.`}
              className="relative aspect-square w-[min(74vw,34dvh)] [@media(max-height:700px)]:w-[min(70vw,30dvh)] sm:w-[min(60vw,38dvh)] lg:w-[min(100%,58dvh,540px)] sm:max-lg:landscape:!w-[min(100%,calc(100dvh-170px),540px)] max-sm:!w-[min(100cqw,100cqh)]"
            >
              <VerticalsOrbit
                labels={benefits.map((b) => b.label)}
                posRef={posRef}
                litRef={litRef}
                active={active}
                visible={visible}
                onSelect={goTo}
              />
            </div>
          </div>

          {/* The benefit at the top of the dial. All six share one grid cell, so the panel keeps the
              height of the longest and nothing below it jumps. Hidden from screen readers, which get
              the full list below. Phones: a soft card anchored at the bottom of the pinned screen. */}
          <div className="mx-auto grid w-full max-w-xl max-sm:flex-none max-sm:rounded-2xl max-sm:border max-sm:border-white/10 max-sm:bg-white/[0.04] max-sm:px-5 max-sm:py-3.5 lg:col-start-1 lg:row-start-2 lg:mx-0 lg:self-center sm:max-lg:landscape:col-start-1 sm:max-lg:landscape:row-start-2 sm:max-lg:landscape:mx-0 sm:max-lg:landscape:self-start">
            {benefits.map((b, i) => (
              <div
                key={b.title}
                aria-hidden="true"
                className={`[grid-area:1/1] transition-opacity duration-500 motion-reduce:transition-none ${
                  i === shown ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              >
                {/* The status pill sits above the numbered title. */}
                <div className="flex flex-col-reverse items-start gap-2 sm:gap-3">
                  <h3 className="font-brand text-title text-accent sm:text-heading lg:text-section-title">
                    <span className="mr-2 text-white/40 sm:mr-3">{String(i + 1).padStart(2, '0')}</span>
                    {b.title}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-label ${
                      b.status === 'Live' ? 'bg-accent text-white' : 'border border-white/15 text-white/70'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
                {/* Phones and very short screens (a phone held sideways, a laptop at 200% zoom): the checklist
                    (or paragraph) goes, so the dial keeps its room and the title is never cut off. */}
                {b.summary && (
                  <p className="mt-1.5 text-sm leading-snug text-white/65 sm:hidden [@media(max-height:480px)]:hidden">
                    {b.summary}
                  </p>
                )}
                {b.description ? (
                  <div className="mt-3 max-w-xl space-y-3 text-sm leading-relaxed text-white/65 sm:mt-5 sm:text-base lg:text-lg max-sm:hidden [@media(max-height:480px)]:hidden">
                    {b.description.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                ) : (
                  <ul className="mt-3 flex flex-col gap-1.5 text-sm text-white/65 sm:mt-5 sm:gap-2.5 sm:text-base lg:gap-3 lg:text-lg max-sm:hidden [@media(max-height:480px)]:hidden">
                    {b.outcomes.map((o) => (
                      <li key={o} className="flex items-start gap-2.5">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="mt-0.5 size-4 flex-none text-accent sm:mt-1"
                        >
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </PageContainer>

        {/* Screen readers get all six at once instead of the scroll-driven panel. */}
        <ul className="sr-only">
          {benefits.map((b) => (
            <li key={b.title}>
              {b.title} ({b.status}): {b.description?.join(' ') ?? `${b.outcomes.join('. ')}.`}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
