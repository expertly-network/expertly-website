'use client';

import Image from 'next/image';
import type { PlatformStatsResponse } from '@shared/platform-stats';
import { mustHotlink } from '@/lib/images';
import { floorStat } from '@/lib/stat-floor';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui';
import { LOGO_MARK_ASPECT_RATIO, LOGO_SRC } from '@/lib/brand';

// The homepage's animated hero section, with member photos orbiting the GrowXQ mark.
// PART1 wraps on its own (balanced), PART2 always starts its own line. Phones set PART1 as the two
// fixed lines in PART1_PHONE_LINES, each kept to one row by a viewport-scaled font size; the swap
// happens in CSS at `sm` so there is no hydration flash.
const PART1 = 'Build the skill you need';
const PART2 = 'or find an expert with it.';
const PART1_PHONE_LINES = ['Build the skill you need'] as const;

function ArrowIcon() {
  return (
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
  );
}

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
    dots: [{ deg: 90 }, { deg: 210, size: 'sm' }, { deg: 330 }],
  },
  {
    radius: 188,
    size: 376,
    spin: 'cw',
    dots: [{ deg: 0, size: 'lg' }, { deg: 90 }, { deg: 180, size: 'lg' }, { deg: 270, size: 'sm' }],
  },
  {
    radius: 243.5,
    size: 487,
    spin: 'cw',
    dots: [{ deg: 45, size: 'sm' }, { deg: 135, size: 'lg' }, { deg: 225 }, { deg: 315, size: 'lg' }],
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

const DOT_SIZE = { sm: 42, md: 46, lg: 52 } as const;
// Slots without a member photo render as small glowing points, so the orbit reads as a
// constellation rather than a row of empty avatars.
const POINT_SIZE = { sm: 6, md: 8, lg: 10 } as const;
// The outer avatar reaches 328px from the centre. Keep the whole animated drawing inside
// its layout box so neither a narrow column nor the hero's overflow clipping cuts it off.
const ORBIT_EXTENT = 664;
const SLOT_COUNT = RINGS.reduce((sum, r) => sum + r.dots.length, 0);

/** Spreads however many photos there are evenly across the orbit's slots. */
function photoForSlots(urls: string[]): (string | undefined)[] {
  const slots: (string | undefined)[] = Array(SLOT_COUNT).fill(undefined);
  const n = Math.min(urls.length, SLOT_COUNT);
  for (let k = 0; k < n; k++) slots[Math.floor((k * SLOT_COUNT) / n)] = urls[k];
  return slots;
}

function useCountUp(target: number, durationMs: number, startDelayMs: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTyped(text);
      setDone(true);
      return;
    }
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

/** The headline's green line, typed out; its finished height is reserved so nothing below jumps. */
function TypedLine({ text, className = '' }: { text: string; className?: string }) {
  const { typed, done } = useTypewriter(text, 900);
  return (
    <span className={`relative text-accent ${className}`}>
      <span className="invisible" aria-hidden="true">
        {text}
      </span>
      <span className="sr-only">{text}</span>
      <span className="absolute inset-0" aria-hidden="true">
        {typed}
        {!done && (
          <span
            className="ml-[3px] inline-block h-[0.82em] w-[3px] bg-accent align-middle"
            style={{ animation: 'hs-blink 0.85s steps(1) infinite' }}
          />
        )}
      </span>
    </span>
  );
}

export function StellarOrbitHero({
  avatarUrls = [],
  stats: platformStats = null,
  userCta,
  secondaryCta = { href: '/apply', label: 'Apply as a member' },
}: {
  avatarUrls?: string[];
  /** Real counts from GET /v1/stats; null hides the stat row instead of showing made-up numbers. */
  stats?: PlatformStatsResponse | null;
  userCta: { href: string; label: string };
  /** Second hero button, by viewer: Apply (visitors/clients), View my profile (members), admin panel (admins). */
  secondaryCta?: { href: string; label: string };
}) {
  const [revealed, setRevealed] = useState(false);
  const orbitBox = useRef<HTMLDivElement>(null);
  const [orbitScale, setOrbitScale] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 50);
    return () => clearTimeout(t);
  }, []);
  useLayoutEffect(() => {
    const box = orbitBox.current;
    if (!box) return;
    const measure = () => setOrbitScale(box.clientWidth / ORBIT_EXTENT);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Shown rounded down with a "+" (26 → 25+), so the claim stays true as the numbers grow.
  const expertsStat = floorStat(platformStats?.members ?? 0);
  const jurisdictionsStat = floorStat(platformStats?.jurisdictions ?? 0);
  const areasStat = floorStat(platformStats?.practiceAreas ?? 0);
  const consultationsStat = floorStat(platformStats?.consultations ?? 0);
  const experts = useCountUp(expertsStat.value, 1600, 1000);
  const jurisdictions = useCountUp(jurisdictionsStat.value, 1600, 1000);
  const areas = useCountUp(areasStat.value, 1200, 1000);
  const consultations = useCountUp(consultationsStat.value, 1600, 1000);
  const slotPhotos = photoForSlots(avatarUrls);

  const stats = (
    [
      [experts, expertsStat.plus ? '+' : '', 'Verified Experts', 'Experts'],
      [jurisdictions, jurisdictionsStat.plus ? '+' : '', 'Jurisdictions', null],
      [areas, areasStat.plus ? '+' : '', 'Practice Areas', null],
      [consultations, consultationsStat.plus ? '+' : '', 'Consultations', null],
    ] as const
  ).map(([num, suffix, label, phoneLabel]) => (
    <div key={label} className="flex min-w-0 flex-col gap-1">
      <span className="text-stat font-semibold leading-none text-bg-card">
        {num}
        {suffix}
      </span>
      <span className="text-[11px] font-medium leading-snug text-white/60 sm:text-caption">
        {phoneLabel ? (
          <>
            {/* Shorter on phones so every label fits one line in the four-column row. */}
            <span className="sm:hidden">{phoneLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </span>
    </div>
  ));

  return (
    <section
      id="hero-stellar"
      className="relative flex min-h-[calc(100svh-61px)] flex-col overflow-hidden bg-ink text-bg-card motion-reduce:[&_*]:!animate-none lg:min-h-dvh"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[8%] -top-[15%] h-[900px] w-[900px] rounded-full"
        style={{
          background: 'radial-gradient(circle, color-mix(in oklab, var(--accent) 7%, transparent) 0%, transparent 65%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[5%] left-[5%] h-[600px] w-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, color-mix(in oklab, var(--accent) 4%, transparent) 0%, transparent 65%)',
        }}
      />

      <div className="relative z-[1] mx-auto flex w-full max-w-[1520px] flex-1 items-center px-6 pb-6 pt-9 sm:py-12 lg:px-[clamp(2rem,4vw,4rem)] lg:pb-10 lg:pt-[clamp(5rem,10dvh,6.125rem)]">
        <div className="grid w-full min-w-0 items-center gap-2 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-[clamp(1.5rem,3vw,3.5rem)]">
          {/* Left */}
          <div
            className="mx-auto flex w-full min-w-0 max-w-[580px] flex-col text-center [container-type:inline-size] lg:mx-0 lg:text-left"
            style={{ animation: 'hs-fade-up 1s cubic-bezier(0.22,1,0.36,1) 0.1s both' }}
          >
            <h1 className="font-brand text-[clamp(26px,9.2vw,40px)] sm:max-w-none sm:text-[clamp(36px,8.3cqi,60px)] font-semibold leading-[1.02] tracking-[-0.035em] text-bg-card">
              {/* Phones: one row per line. The hidden copy is display:none, so it is not read out twice. */}
              {PART1_PHONE_LINES.map((line) => (
                <span key={line} className="block whitespace-nowrap sm:hidden">
                  {line}
                </span>
              ))}
              <span className="hidden [text-wrap:balance] sm:block">{PART1}</span>
              <TypedLine text={PART2} className="block max-sm:whitespace-nowrap" />
            </h1>

            {/* Phones: no subtitle, just the headline. */}
            <p
              className="mx-auto hidden text-lede text-white/50 sm:mt-6 sm:block sm:max-w-[460px] lg:mx-0"
              style={{ animation: 'hs-fade-in 0.7s ease 1.9s both' }}
            >
              Access to trusted AI tools, practical professional training, and a verified global network, to bring the
              resources, expertise, and capabilities of a large firm within reach of every practicing professional.
            </p>

            {/* Larger screens use the main hero actions; phones get their two actions below the orbit. */}
            <div
              className="hidden sm:mt-10 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3.5 lg:justify-start"
              style={{ animation: 'hs-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) 2.2s both' }}
            >
              <Button href="/members" variant="accent" className="whitespace-nowrap max-sm:!px-3">
                Find an Expert
                <ArrowIcon />
              </Button>
              <Button href={secondaryCta.href} variant="ghost-dark" className="whitespace-nowrap max-sm:!px-3">
                {secondaryCta.label}
              </Button>
            </div>

            {platformStats && (
              <div
                className="mx-auto mt-[clamp(2rem,5dvh,3.25rem)] hidden sm:grid w-full max-w-full grid-cols-4 gap-x-2 border-t border-white/[0.08] pt-7 text-center sm:gap-x-6 lg:mx-0 lg:text-left"
                style={{ animation: 'hs-fade-in 0.6s ease 2.5s both' }}
              >
                {/* Tablet and up: the stats sit under the CTAs. Phones show them below the orbit. */}
                {stats}
              </div>
            )}
          </div>

          {/* Right: one drawing scaled to the space the grid gives it. The layout square includes
              the outer photos, so rotation never reaches outside the column. */}
          <div
            className="my-6 flex min-w-0 items-center justify-center sm:my-0"
            style={{ animation: 'hs-scale-in 1.2s cubic-bezier(0.22,1,0.36,1) 0.3s both' }}
            aria-hidden="true"
          >
            <div
              ref={orbitBox}
              className="relative aspect-square w-full"
              style={{ maxWidth: `min(${ORBIT_EXTENT}px, 75dvh)` }}
            >
              <div
                className="absolute left-1/2 top-1/2 h-[540px] w-[540px]"
                style={{ transform: `translate(-50%, -50%) scale(${orbitScale})` }}
              >
                {RINGS.map((ring, ringIdx) => {
                  const priorDots = RINGS.slice(0, ringIdx).reduce((sum, r) => sum + r.dots.length, 0);
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
                        const photoUrl = slotPhotos[priorDots + i];
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
                            {/* Isolated on its own element so the animation doesn't conflict with a static transform.
                                Zero-sized so it spins about the exact point on the ring: a box the size of
                                the photo would spin about its own centre and swing the photo off the ring. */}
                            <div className="h-0 w-0" style={{ animation: `${counterSpin} 40s linear infinite` }}>
                              {photoUrl ? (
                                <Image
                                  src={photoUrl}
                                  unoptimized={mustHotlink(photoUrl)}
                                  alt=""
                                  width={dim * 2}
                                  height={dim * 2}
                                  className="max-w-none rounded-full object-cover"
                                  style={avatarStyle}
                                />
                              ) : (
                                <div
                                  className="rounded-full bg-accent"
                                  style={{
                                    width: POINT_SIZE[dot.size ?? 'md'],
                                    height: POINT_SIZE[dot.size ?? 'md'],
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow:
                                      '0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent), 0 0 18px 2px color-mix(in oklab, var(--accent) 55%, transparent)',
                                    opacity: revealed ? 0.9 : 0,
                                    transition: `opacity 0.6s ease ${(ringIdx * 0.4 + i * 0.15).toFixed(2)}s`,
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
                  {/* The mark from the light-on-dark lockup, cropped to its symbol. */}
                  <svg
                    width={Math.round(52 * LOGO_MARK_ASPECT_RATIO)}
                    height={52}
                    viewBox="0 0 62 61"
                    className="block overflow-hidden"
                  >
                    <image href={LOGO_SRC.dark} width="299" height="61" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2.5 sm:hidden">
            <Button
              href={userCta.href}
              variant="secondary"
              className="!px-2 text-center leading-tight max-[359px]:text-xs"
            >
              {userCta.label}
            </Button>
            <Button
              href={secondaryCta.href}
              variant="accent"
              className="!px-2 text-center leading-tight max-[359px]:text-xs"
            >
              {secondaryCta.label}
            </Button>
          </div>

          {/* Phones: the stats close the hero below the orbit. */}
          {platformStats && (
            <div
              className="grid w-full grid-cols-4 gap-x-2 border-t border-white/[0.08] pt-6 text-center sm:hidden"
              style={{ animation: 'hs-fade-in 0.6s ease 2.5s both' }}
            >
              {stats}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
