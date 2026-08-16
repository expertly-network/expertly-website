'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// The real, currently-active homepage hero — design/static_html/index.html ships 4 hero
// variants in one file, switched via `data-hero` on <html>; the file as configured
// (data-hero="orbit") activates THIS one, not the simpler "split" hero this app built
// first. Styling ported from styles.css's "STELLAR ORBIT HERO" block (~line 8927) since
// none of it lives in home.css despite the name.
//
// Known simplifications (not silently skipped):
// - Orbit ring borders use a flat translucent border instead of the original's
//   gradient-fade mask-composite trick (::after with mask-composite:exclude) — visually
//   close, meaningfully simpler to implement and maintain.
// - The typewriter effect here is a plain character-by-character type-in. The original
//   pre-measures PART2's final line breaks and hard-inserts them as typing progresses, so
//   the heading's height is locked upfront and nothing below it ever shifts. This version
//   can reflow by one line on narrow viewports while typing — a real but minor difference.
// - Count-up start delays are approximated (~1s stagger), not read from the original's
///  exact setTimeout values (that logic sits deeper in index.html's inline script than
//   was read for this pass).
// - The hero's own top-left logo (present in the original because the sidebar starts
//   collapsed to an icon rail during the hero) is omitted here — this app's sidebar
//   doesn't have that collapse behavior yet (see components/nav/Sidebar.tsx's own
//   comment), so showing a second logo here would just look duplicated.

const PART1 = "The Right Finance & Legal Expert\nIsn't Out of Reach,";
const PART2 = "They're Already in Our Network.";

type Ring = {
  radius: number;
  size: number;
  spin: 'cw' | 'ccw';
  avatars: { deg: number; src: string; size?: 'lg' | 'xl' }[];
};

const RINGS: Ring[] = [
  {
    radius: 132.5,
    size: 265,
    spin: 'ccw',
    avatars: [
      { deg: 90, src: 'https://randomuser.me/api/portraits/women/1.jpg' },
      { deg: 210, src: 'https://randomuser.me/api/portraits/men/10.jpg' },
      { deg: 330, src: 'https://randomuser.me/api/portraits/women/20.jpg' },
    ],
  },
  {
    radius: 188,
    size: 376,
    spin: 'cw',
    avatars: [
      { deg: 0, src: 'https://randomuser.me/api/portraits/men/15.jpg', size: 'lg' },
      { deg: 90, src: 'https://randomuser.me/api/portraits/women/25.jpg' },
      { deg: 180, src: 'https://randomuser.me/api/portraits/men/30.jpg', size: 'lg' },
      { deg: 270, src: 'https://randomuser.me/api/portraits/women/35.jpg' },
    ],
  },
  {
    radius: 243.5,
    size: 487,
    spin: 'cw',
    avatars: [
      { deg: 45, src: 'https://randomuser.me/api/portraits/men/40.jpg' },
      { deg: 135, src: 'https://randomuser.me/api/portraits/women/50.jpg', size: 'lg' },
      { deg: 225, src: 'https://randomuser.me/api/portraits/men/55.jpg' },
      { deg: 315, src: 'https://randomuser.me/api/portraits/women/60.jpg', size: 'lg' },
    ],
  },
  {
    radius: 299,
    size: 598,
    spin: 'ccw',
    avatars: [
      { deg: 0, src: 'https://randomuser.me/api/portraits/men/65.jpg', size: 'lg' },
      { deg: 60, src: 'https://randomuser.me/api/portraits/women/70.jpg' },
      { deg: 120, src: 'https://randomuser.me/api/portraits/men/75.jpg', size: 'xl' },
      { deg: 180, src: 'https://randomuser.me/api/portraits/women/80.jpg' },
      { deg: 240, src: 'https://randomuser.me/api/portraits/men/85.jpg', size: 'lg' },
      { deg: 300, src: 'https://randomuser.me/api/portraits/women/90.jpg' },
    ],
  },
];

const AVATAR_SIZE = { undefined: 44, lg: 58, xl: 66 } as const;

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

export function StellarOrbitHero() {
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
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-ink text-bg-card">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[8%] -top-[15%] h-[900px] w-[900px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(0,165,130,0.07) 0%, transparent 65%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[5%] left-[5%] h-[600px] w-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(0,165,130,0.04) 0%, transparent 65%)' }}
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
              className="mx-auto mt-6 max-w-[460px] text-[16.5px] leading-[1.65] tracking-[-0.005em] text-white/50 lg:mx-0"
              style={{ animation: 'hs-fade-in 0.7s ease 1.9s both' }}
            >
              A specialist network of verified senior practitioners. Skip the referral chains
              and junior associates. Search, verify credentials, and meet the right expert
              directly.
            </p>

            <div
              className="mt-10 flex flex-wrap items-center justify-center gap-3.5 lg:justify-start"
              style={{ animation: 'hs-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) 2.2s both' }}
            >
              <Link
                href="/members"
                className="group inline-flex items-center gap-2.5 rounded-full border border-accent bg-accent px-7 py-3.5 text-[15px] font-medium tracking-[-0.01em] text-bg-card transition-colors hover:border-accent-2 hover:bg-accent-2"
              >
                Find an Expert
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-[3px]" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/apply"
                className="inline-flex items-center rounded-full border border-white/[0.14] px-[22px] py-[13px] text-[15px] font-normal text-white/55 transition-colors hover:border-white/35 hover:text-bg-card"
              >
                Apply to join
              </Link>
            </div>

            <div
              className="mx-auto mt-[52px] flex max-w-full flex-wrap justify-center gap-x-7 gap-y-4 border-t border-white/[0.08] pt-7 lg:mx-0 lg:justify-start"
              style={{ animation: 'hs-fade-in 0.6s ease 2.5s both' }}
            >
              {[
                [experts, '+', 'Verified Experts'],
                [jurisdictions, '+', 'Jurisdictions'],
                [areas, '', 'Practice Areas'],
                [consultations, '+', 'Consultations'],
              ].map(([num, suffix, label]) => (
                <div key={label as string} className="flex flex-col gap-1">
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

          {/* Right: orbit */}
          <div
            className="hidden flex-1 items-center justify-center lg:flex"
            style={{ animation: 'hs-scale-in 1.2s cubic-bezier(0.22,1,0.36,1) 0.3s both' }}
            aria-hidden="true"
          >
            <div className="relative h-[540px] w-[540px] flex-none translate-x-[40px]">
              {RINGS.map((ring, ringIdx) => (
                <div
                  key={ringIdx}
                  className="hs-orbit-ring absolute left-1/2 top-1/2 rounded-full border border-accent/30"
                  style={{
                    width: ring.size,
                    height: ring.size,
                    marginTop: -ring.size / 2,
                    marginLeft: -ring.size / 2,
                    animation: `${ring.spin === 'cw' ? 'hs-spin-cw' : 'hs-spin-ccw'} 40s linear infinite`,
                  }}
                >
                  {ring.avatars.map((avatar, i) => {
                    const dim = AVATAR_SIZE[avatar.size ?? 'undefined'];
                    const counterSpin = ring.spin === 'ccw' ? 'hs-spin-cw' : 'hs-spin-ccw';
                    return (
                      <div
                        key={i}
                        className="absolute left-1/2 top-1/2"
                        style={{ transform: `rotate(${avatar.deg}deg) translateX(${ring.radius}px)` }}
                      >
                        <div style={{ transform: `translate(-50%, -50%) rotate(${-avatar.deg}deg)` }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={avatar.src}
                            alt=""
                            width={dim}
                            height={dim}
                            className="block rounded-full border-2 object-cover"
                            style={{
                              width: dim,
                              height: dim,
                              borderColor: 'rgba(0,165,130,0.5)',
                              boxShadow: '0 0 0 3px var(--ink), 0 3px 10px rgba(11,11,12,0.5)',
                              animation: `${counterSpin} 40s linear infinite`,
                              opacity: revealed ? 1 : 0,
                              transition: `opacity 0.6s ease ${(ringIdx * 0.4 + i * 0.15).toFixed(2)}s`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="absolute left-1/2 top-1/2 z-10 flex h-[116px] w-[116px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent/25 [background:radial-gradient(circle_at_center,rgba(0,165,130,0.1)_0%,rgba(0,165,130,0.04)_60%,transparent_80%)]">
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
    </section>
  );
}
