'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui';

// The homepage hero — design/static_html/index.html ships 4 hero variants in one file,
// switched via `data-hero` on <html>; the file as configured (data-hero="orbit") activates
// this one. Styling ported from assets/styles.css's "STELLAR ORBIT HERO" block (~line 8927)
// since none of it lives in home.css despite the section's name; keyframes live in
// globals.css (hs-fade-up/hs-fade-in/hs-scale-in/hs-spin-cw/hs-spin-ccw/hs-blink) since
// they're single-purpose to this component.
//
// Deliberate simplifications vs. the prototype (documented, not silently skipped):
// - The typewriter effect is a plain character-by-character type-in; the original
//   pre-measures line breaks so the heading's height never shifts while typing. This
//   version can reflow by one line on narrow viewports mid-type — a minor difference.
// - Orbit avatars use real member photoUrls (passed down from the homepage's already-fetched
//   members list) when available, falling back to a decorative gradient dot otherwise — no
//   frontend-hardcoded hotlinking to a third-party placeholder service either way.

const PART1 = "The Right Finance & Legal Expert\nIsn't Out of Reach,";
const PART2 = "They're Already in Our Network.";

type Ring = {
  radius: number;
  size: number;
  spin: 'cw' | 'ccw';
  dots: { deg: number; size?: 'sm' | 'md' | 'lg' }[];
};

const RINGS: Ring[] = [
  {
    radius: 132.5,
    size: 265,
    spin: 'ccw',
    dots: [
      { deg: 90 },
      { deg: 210, size: 'sm' },
      { deg: 330 },
    ],
  },
  {
    radius: 188,
    size: 376,
    spin: 'cw',
    dots: [
      { deg: 0, size: 'lg' },
      { deg: 90 },
      { deg: 180, size: 'lg' },
      { deg: 270, size: 'sm' },
    ],
  },
  {
    radius: 243.5,
    size: 487,
    spin: 'cw',
    dots: [
      { deg: 45, size: 'sm' },
      { deg: 135, size: 'lg' },
      { deg: 225 },
      { deg: 315, size: 'lg' },
    ],
  },
  {
    radius: 299,
    size: 598,
    spin: 'ccw',
    dots: [
      { deg: 0, size: 'lg' },
      { deg: 60, size: 'sm' },
      { deg: 120 },
      { deg: 180, size: 'sm' },
      { deg: 240, size: 'lg' },
      { deg: 300 },
    ],
  },
];

const DOT_SIZE = { sm: 30, md: 44, lg: 58 } as const;

function useCountUp(target: number, durationMs: number, startDelayMs: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const startTimer = setTimeout(() => {
      const start = performance.now();
      function tick(now: number) {
        const progress = Math.min(1, (now - start) / durationMs);
        setValue(Math.round(progress * target));
        if (progress < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }, startDelayMs);
    return () => {
      clearTimeout(startTimer);
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, startDelayMs]);
  return value;
}

function useTypewriter(text: string, startDelayMs: number, charDelayMs = 32) {
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const start = setTimeout(() => {
      for (let i = 1; i <= text.length; i++) {
        timers.push(
          setTimeout(() => {
            if (!cancelled) setTyped(text.slice(0, i));
            if (i === text.length) setDone(true);
          }, i * charDelayMs)
        );
      }
    }, startDelayMs);
    return () => {
      cancelled = true;
      clearTimeout(start);
      timers.forEach(clearTimeout);
    };
  }, [text, startDelayMs, charDelayMs]);
  return { typed, done };
}

export function StellarOrbitHero({ avatarUrls = [] }: { avatarUrls?: string[] }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 50);
    return () => clearTimeout(t);
  }, []);

  const { typed, done } = useTypewriter(PART2, 900);
  const experts = useCountUp(20, 1600, 1000);
  const jurisdictions = useCountUp(20, 1600, 1000);
  const areas = useCountUp(12, 1200, 1000);
  const consultations = useCountUp(100, 2000, 1000);
  const orbitCount = useCountUp(20, 2000, 700);

  return (
    <section
      id="hero-stellar"
      className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-ink text-bg-card"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[8%] -top-[15%] h-[900px] w-[900px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--accent) 7%, transparent) 0%, transparent 65%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[5%] left-[5%] h-[600px] w-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--accent) 4%, transparent) 0%, transparent 65%)',
        }}
      />

      <div className="relative z-[1] mx-auto flex w-full max-w-[1520px] flex-1 items-center px-6 py-12 lg:px-16 lg:py-10">
        <div className="flex w-full flex-col items-center gap-16 lg:flex-row lg:items-center lg:justify-between">
          {/* Left */}
          <div
            className="flex max-w-[580px] flex-1 flex-col text-center lg:text-left"
            style={{ animation: 'hs-fade-up 1s cubic-bezier(0.22,1,0.36,1) 0.1s both' }}
          >
            <h1 className="min-h-[3.8em] text-[clamp(38px,4.2vw,66px)] font-semibold leading-[1.02] tracking-[-0.035em] text-bg-card">
              {PART1.split('\n').map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
              <span className="text-accent">{typed}</span>
              {!done && (
                <span
                  aria-hidden="true"
                  className="ml-[3px] inline-block h-[0.82em] w-[3px] bg-accent align-middle"
                  style={{ animation: 'hs-blink 0.85s steps(1) infinite' }}
                />
              )}
            </h1>

            <p
              className="mx-auto mt-6 max-w-[460px] text-lede text-white/50 lg:mx-0"
              style={{ animation: 'hs-fade-in 0.7s ease 1.9s both' }}
            >
              A specialist network of verified senior practitioners. Skip the referral chains and
              junior associates. Search, verify credentials, and meet the right expert directly.
            </p>

            <div
              className="mt-10 flex flex-wrap items-center justify-center gap-3.5 lg:justify-start"
              style={{ animation: 'hs-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) 2.2s both' }}
            >
              <Button href="/members" variant="accent">
                Find an Expert
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="ml-1 inline-block"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Button>
              <Button href="/apply" variant="ghost-dark">
                Apply to join
              </Button>
            </div>

            <div
              className="mx-auto mt-[52px] flex max-w-full flex-wrap justify-center gap-x-7 gap-y-4 border-t border-white/[0.08] pt-7 lg:mx-0 lg:justify-start"
              style={{ animation: 'hs-fade-in 0.6s ease 2.5s both' }}
            >
              {(
                [
                  [experts, '+', 'Verified Experts'],
                  [jurisdictions, '+', 'Jurisdictions'],
                  [areas, '', 'Practice Areas'],
                  [consultations, '+', 'Consultations'],
                ] as const
              ).map(([num, suffix, label]) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="text-xl font-semibold leading-none tracking-[-0.025em] text-bg-card">
                    {num}
                    {suffix}
                  </span>
                  <span className="whitespace-nowrap font-mono text-[10px] font-medium tracking-[0.1em] text-white/35">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: orbit — purely decorative, hidden from assistive tech. Shown at every
              viewport (stacks below the text on mobile, per the flex-col layout above) —
              a fixed-size 540px "design size" scaled down via CSS transform on narrow
              viewports, since the ring radii/dot positions below are all literal px math
              computed for that size, not something to re-derive per breakpoint. */}
          <div
            className="flex flex-1 items-center justify-center"
            style={{ animation: 'hs-scale-in 1.2s cubic-bezier(0.22,1,0.36,1) 0.3s both' }}
            aria-hidden="true"
          >
            <div className="h-[302px] w-[302px] min-[640px]:h-[405px] min-[640px]:w-[405px] lg:h-[540px] lg:w-[540px]">
              <div className="relative h-[540px] w-[540px] flex-none origin-top-left scale-[0.56] min-[640px]:scale-[0.75] lg:translate-x-[40px] lg:scale-100">
                {RINGS.map((ring, ringIdx) => {
                  const priorDots = RINGS.slice(0, ringIdx).reduce(
                    (sum, r) => sum + r.dots.length,
                    0
                  );
                  return (
                    <div
                      key={ringIdx}
                      className="hs-orbit-ring absolute left-1/2 top-1/2 rounded-full"
                      style={{
                        width: ring.size,
                        height: ring.size,
                        marginTop: -ring.size / 2,
                        marginLeft: -ring.size / 2,
                        animation: `${ring.spin === 'cw' ? 'hs-spin-cw' : 'hs-spin-ccw'} 40s linear infinite`,
                      }}
                    >
                      {ring.dots.map((dot, i) => {
                        const dim = DOT_SIZE[dot.size ?? 'md'];
                        const counterSpin = ring.spin === 'ccw' ? 'hs-spin-cw' : 'hs-spin-ccw';
                        const photoUrl = avatarUrls[priorDots + i];
                        const avatarStyle: CSSProperties = {
                          width: dim,
                          height: dim,
                          transform: `translate(-50%, -50%) rotate(${-dot.deg}deg)`,
                          border: '2px solid color-mix(in oklab, var(--accent) 50%, transparent)',
                          boxShadow: '0 0 0 3px var(--ink), 0 3px 10px rgba(11,11,12,0.5)',
                          opacity: revealed ? 1 : 0,
                          transition: `opacity 0.6s ease ${(ringIdx * 0.4 + i * 0.15).toFixed(2)}s`,
                        };
                        return (
                          <div
                            key={i}
                            className="absolute left-1/2 top-1/2"
                            style={{ transform: `rotate(${dot.deg}deg) translateX(${ring.radius}px)` }}
                          >
                            {/* Counter-spin layer: animation-only, no static transform of its
                                own. A CSS animation replaces an element's whole `transform`
                                for its duration — composing it with a *static* transform on
                                the same element (as this used to do) forces the browser to
                                interpolate between mismatched transform-function lists via
                                matrix decomposition, which is what caused the avatars to
                                visibly tilt/wobble instead of staying upright, and to look
                                like they "jumped" once per lap. Isolating the animation on
                                its own element (rotating a bare 0-size box, so there's
                                nothing for it to conflict with) fixes both. */}
                            <div style={{ animation: `${counterSpin} 40s linear infinite` }}>
                              {photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={photoUrl}
                                  alt=""
                                  className="rounded-full object-cover"
                                  style={avatarStyle}
                                />
                              ) : (
                                <div
                                  className="rounded-full"
                                  style={{
                                    ...avatarStyle,
                                    background:
                                      'linear-gradient(135deg, color-mix(in oklab, var(--accent-2) 55%, var(--ink)) 0%, color-mix(in oklab, var(--neon) 35%, var(--ink)) 100%)',
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                <div className="absolute left-1/2 top-1/2 z-10 flex h-[116px] w-[116px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent/25 [background:radial-gradient(circle_at_center,color-mix(in_oklab,var(--accent)_10%,transparent)_0%,color-mix(in_oklab,var(--accent)_4%,transparent)_60%,transparent_80%)]">
                  <div className="text-center">
                    <span className="block text-[28px] font-semibold leading-none tracking-[-0.04em] text-neon">
                      {orbitCount}k+
                    </span>
                    <span className="mt-1 block font-mono text-[9.5px] tracking-[0.1em] text-white/45">
                      Practitioners
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
