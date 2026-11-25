'use client';

import { useEffect, useRef } from 'react';
import { Eyebrow } from '@/components/ui';
import { STICKY_UNDER_MOBILE_BAR } from '@/lib/ui/mobile';
import { FAVICON_SRC } from '@/lib/brand';

// The problem section, both sides of it. The GrowXQ mark sits in the centre of a ring split down the middle: users on the left (beige,
// like their card above), members on the right (brand green). It stays pinned while the questions each side
// is asking come out of it as you scroll, users' on the left and members' on the right: each one
// emerges from behind the ring, settles beside it, then drifts outward and fades, so only a few are on
// screen at once. It opens with two already out, and ends by clearing the stage before the section
// moves on. Styles are written straight to the cards in a frame loop (no React render per scroll).
// Reduced motion: no pinning, the ring with the questions as two static lists. Screen readers always
// get the plain lists.

const GAP = 0.6; // the white cut between slices, in % of the turn
// Each half is cut into three slices of varying size and shade, like a week split between kinds of work.
// Conic gradients start at 12 o'clock and run clockwise: the first half is the right (members, brand
// green), the second the left (users, beige). Proportions are decorative, not data.
// Each half runs light to dark, clockwise.
const SLICES: [share: number, color: string][] = [
  [15, 'color-mix(in oklab, var(--accent) 40%, var(--bg-card))'],
  [17, 'var(--accent)'],
  [18, 'color-mix(in oklab, var(--accent) 65%, var(--ink))'],
  [15, 'var(--bg-alt)'],
  [17, 'color-mix(in oklab, var(--ink) 18%, var(--bg-alt))'],
  [18, 'color-mix(in oklab, var(--ink) 36%, var(--bg-alt))'],
];
const RING = (() => {
  let at = 0;
  const stops = SLICES.flatMap(([share, color]) => {
    const from = at;
    at += share;
    return [`${color} ${from}% ${at - GAP}%`, `var(--bg-card) ${at - GAP}% ${at}%`];
  });
  return `conic-gradient(${stops.join(', ')})`;
})();

type Side = 'user' | 'member';
type Question = {
  q: string;
  side: Side;
  /** Shown on phones too (the rest are desktop and tablet only). */
  phone?: boolean;
};

// Shown in this order, users and members alternating, so each lands on its own side of the ring
// (the slot lists below alternate left/right). Keep it alternating, phone subset included.
const QUESTIONS: Question[] = [
  { q: 'How do I find the right expert for this?', side: 'user', phone: true },
  { q: 'Which AI tools can I trust with client data?', side: 'member', phone: true },
  { q: 'Is this person actually qualified?', side: 'user', phone: true },
  { q: 'How do new clients find me?', side: 'member', phone: true },
  { q: 'Who can I trust with a matter abroad?', side: 'user', phone: true },
  { q: 'How do I grow beyond my own network?', side: 'member' },
  { q: 'What will it cost before I commit?', side: 'user' },
  { q: 'How do I keep up with AI?', side: 'member' },
  { q: 'Where do I get reliable answers on new rules?', side: 'user' },
  { q: 'Where do I find good people before busy season?', side: 'member', phone: true },
];

const CARD_CLASS: Record<Side, string> = {
  user: 'border border-line bg-bg-alt text-ink',
  member: 'bg-accent text-bg',
};

// Each card's header row: who is asking, like a table heading over the question.
const HEADING: Record<Side, { label: string; className: string }> = {
  user: { label: 'User', className: 'border-line text-ink-3' },
  member: { label: 'Member', className: 'border-white/25 text-white/80' },
};

function CardBody({ q }: { q: Question }) {
  const h = HEADING[q.side];
  return (
    <>
      <span className={`mb-1.5 block border-b pb-1.5 text-mono-label ${h.className}`}>{h.label}</span>
      {q.q}
    </>
  );
}

// Where questions settle, as a fraction of the stage's half-width / half-height (then pushed clear of
// the ring and kept inside the stage). Questions take the slots in turn, and each one's time on screen
// (SPAN) is shorter than a full round of slots, so no two questions ever share a slot.
// Large screens: six slots around the ring, alternating sides (even = left, users), top to bottom.
const SLOTS_WIDE: [number, number][] = [
  [-0.62, -0.78],
  [0.62, -0.6],
  [-0.66, -0.05],
  [0.66, 0.1],
  [-0.56, 0.68],
  [0.58, 0.76],
];
const SPAN_WIDE = 0.34;
// Phones and tablets: no room beside the ring, so users' questions come out above it (leaning left)
// and members' below (leaning right).
const SLOTS_NARROW: [number, number][] = [
  [-0.3, -0.85],
  [0.3, 0.55],
];
// Share of the scroll each question is on screen. Narrow layouts have one slot each, so a slot comes
// round every second question: SPAN must stay under two steps.
const SPAN_PHONE = 0.3; // 6 questions
const SPAN_TABLET = 0.19; // all 10 questions
// Questions stop arriving here; whatever is left on screen then fades out together before the
// section scrolls away.
const END = 0.9;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Distance from the ring's centre to the nearest point of a card centred at (x, y). */
function gapToCard(x: number, y: number, cw: number, ch: number) {
  return Math.hypot(Math.max(0, Math.abs(x) - cw / 2), Math.max(0, Math.abs(y) - ch / 2));
}

/**
 * Where a card settles: its preferred spot, pushed outward until it clears the ring, never past the
 * stage edge. If there is no room beside the ring (phones), it goes above or below instead.
 */
function settle(fx: number, fy: number, cw: number, ch: number, maxX: number, maxY: number, clear: number) {
  let x = fx * maxX;
  let y = fy * maxY;
  // Sideways first, so cards beside the ring keep their height and never slide into a neighbour.
  for (let k = 0; k < 40 && gapToCard(x, y, cw, ch) < clear && Math.abs(x) < maxX; k++) {
    x = clamp((x || 1) * 1.06, -maxX, maxX);
  }
  if (gapToCard(x, y, cw, ch) < clear) {
    const dir = y < 0 ? -1 : 1;
    y = clamp(dir * (clear + ch / 2), -maxY, maxY);
  }
  return [x, y] as const;
}

export function ProblemRing() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const section = sectionRef.current;
      const stage = stageRef.current;
      if (!section || !stage) return;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const progress = clamp(-rect.top / travel);
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const phone = w < 640;
      const narrow = w < 1024;
      const slots = narrow ? SLOTS_NARROW : SLOTS_WIDE;
      const clear = (ringRef.current?.offsetWidth ?? 0) / 2 + 14;
      const shown = QUESTIONS.map((q, i) => ({ q, el: cards.current[i] })).filter(
        ({ q, el }) => el && (!phone || q.phone)
      );
      const n = shown.length;
      const span = phone ? SPAN_PHONE : narrow ? SPAN_TABLET : SPAN_WIDE;
      // A head start so the section never opens empty: at the top, the first question is already out
      // and the second is part way out (t = 0.15). The last one has settled by END.
      const step = (END - 0.3 * span) / (n - 2);
      const lead = step + 0.15 * span;
      const exit = 1 - clamp((progress - END) / (1 - END)); // all fade together at the end
      shown.forEach(({ el }, k) => {
        if (!el) return;
        const start = k * step - lead;
        const t = clamp((progress - start) / span);
        const [fx, fy] = slots[k % slots.length];
        const cw = el.offsetWidth;
        const ch = el.offsetHeight;
        const maxX = Math.max(0, w / 2 - cw / 2 - 20); // keep the page gutter
        const maxY = Math.max(0, h / 2 - ch / 2 - 4);
        // Emerging from the ring: out quickly while still faint, then it brightens in place (so the
        // half-lit second question at the top of the section is already clear of the ring).
        const out = easeOut(clamp(t / 0.2));
        const drift = clamp((t - 0.4) / 0.6); // settled, floating up
        const [sx, sy] = settle(fx, fy, cw, ch, maxX, maxY, clear);
        // Once settled it keeps drifting gently away from the ring, never back into it.
        const len = Math.hypot(sx, sy) || 1;
        const x = clamp(sx * out + (sx / len) * drift * 28, -maxX, maxX);
        const y = clamp(sy * out + (sy / len) * drift * 28, -maxY, maxY);
        const opacity = t <= 0 || t >= 1 ? 0 : Math.min(clamp(t / 0.34), clamp((1 - t) / 0.25)) * exit;
        el.style.opacity = String(opacity);
        el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(0.6 + 0.4 * out).toFixed(3)})`;
        el.style.visibility = opacity > 0 ? 'visible' : 'hidden';
        el.style.zIndex = out >= 1 ? '1' : '0'; // a settled card stays above one still emerging
      });
      // Hide the desktop-only cards on phones.
      QUESTIONS.forEach((q, i) => {
        const el = cards.current[i];
        if (el && phone && !q.phone) el.style.visibility = 'hidden';
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="verticals-title"
      className="relative h-[240vh] motion-reduce:h-auto motion-reduce:py-12 sm:h-[230vh] sm:motion-reduce:py-24"
    >
      <div
        className={`sticky ${STICKY_UNDER_MOBILE_BAR} flex h-[calc(100dvh-61px)] flex-col overflow-hidden pt-8 motion-reduce:static motion-reduce:h-auto motion-reduce:overflow-visible motion-reduce:pt-0 sm:pt-14 lg:top-0 lg:h-dvh lg:pt-16`}
      >
        <div className="mx-auto max-w-3xl px-5 text-center">
          <Eyebrow>The problem</Eyebrow>
          <h2
            id="verticals-title"
            className="font-brand mx-auto mt-4 scroll-mt-24 text-section-title text-ink [text-wrap:balance]"
          >
            Two sides of the same coin, one shared question:{' '}
            <span className="text-accent">How do we find the right resource?</span>
          </h2>
          <p className="mx-auto mt-4 hidden max-w-xl text-base leading-relaxed text-ink-3 sm:block sm:text-lg">
            Clients can&apos;t tell who&apos;s qualified. Professionals can&apos;t reach the people looking for them.
            Both are exploring how to develop their skills.
          </p>
        </div>

        {/* The stage: the split ring in the middle, each side's questions coming out of its half. */}
        <div
          ref={stageRef}
          className="relative mx-auto my-4 w-full max-w-7xl flex-1 px-5 motion-reduce:my-10 motion-reduce:flex-none"
        >
          <ul aria-hidden="true" className="motion-reduce:hidden">
            {QUESTIONS.map((q, i) => (
              <li
                key={q.q}
                ref={(el) => {
                  cards.current[i] = el;
                }}
                style={{ opacity: 0, visibility: 'hidden' }}
                className={`absolute left-1/2 top-1/2 z-0 w-max max-w-[230px] rounded-2xl px-4 py-3 text-sm leading-snug shadow-panel will-change-transform sm:max-w-[280px] sm:text-base ${CARD_CLASS[q.side]}`}
              >
                <CardBody q={q} />
              </li>
            ))}
          </ul>

          <figure className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 motion-reduce:static motion-reduce:translate-x-0 motion-reduce:translate-y-0">
            <div
              ref={ringRef}
              aria-hidden="true"
              className="relative size-48 rounded-full sm:size-64 lg:size-80"
              style={{ background: RING }}
            >
              <div className="absolute inset-[16%] flex items-center justify-center rounded-full bg-bg-card shadow-panel">
                {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG mark */}
                <img src={FAVICON_SRC.light} alt="" className="size-[45%]" />
              </div>
            </div>
          </figure>
        </div>

        {/* Reduced motion: the questions, still, users' then members'. */}
        <div aria-hidden="true" className="mx-auto hidden max-w-3xl flex-col gap-3 px-5 motion-reduce:flex">
          {(['user', 'member'] as const).map((side) => (
            <ul key={side} className="flex flex-wrap justify-center gap-2">
              {QUESTIONS.filter((q) => q.side === side).map((q) => (
                <li key={q.q} className={`rounded-2xl px-4 py-2.5 text-base ${CARD_CLASS[side]}`}>
                  <CardBody q={q} />
                </li>
              ))}
            </ul>
          ))}
        </div>

        <div className="sr-only">
          {(['user', 'member'] as const).map((side) => (
            <div key={side}>
              <p>{side === 'user' ? 'Users ask:' : 'Members ask:'}</p>
              <ul>
                {QUESTIONS.filter((q) => q.side === side).map((q) => (
                  <li key={q.q}>{q.q}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
