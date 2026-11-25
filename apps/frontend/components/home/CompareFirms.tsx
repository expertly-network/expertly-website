'use client';

import { useEffect, useRef, useState } from 'react';
import { Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { LOGO_MARK_ASPECT_RATIO, LOGO_SRC } from '@/lib/brand';

// One glass card, two halves: the same six areas scattered for a firm on its own, then connected
// through GrowXQ. When it scrolls into view, once, the lines draw in, the hub pops, the pills light up
// one after another and small pulses start travelling to the hub. With reduced motion it is static.

const AREAS = ['Technology', 'Reach', 'Networking', 'Training', 'Perks', 'Recruiting'] as const;

const PILL_W = 124;
const PILL_H = 34;

// Left half: where each area floats on its own (pill centre in a 440 x 260 box).
const SCATTER: readonly (readonly [number, number])[] = [
  [84, 52],
  [318, 40],
  [205, 112],
  [352, 160],
  [110, 176],
  [248, 226],
];
// A slight tilt and a slow drift for each, so they read as loose and unplaced.
const TILT = [-3, 2, -1.5, 3, 2.5, -2] as const;

// Right half: three pills either side of the hub.
const HUB = { x: 220, y: 130, r: 34 };
const SPOKES: readonly { x: number; y: number; side: -1 | 1 }[] = [
  { x: 75, y: 62, side: -1 },
  { x: 75, y: 130, side: -1 },
  { x: 75, y: 198, side: -1 },
  { x: 365, y: 62, side: 1 },
  { x: 365, y: 130, side: 1 },
  { x: 365, y: 198, side: 1 },
];

const DOTS =
  '[background-image:radial-gradient(circle,color-mix(in_oklab,white_12%,transparent)_1px,transparent_1.2px)] [background-size:18px_18px]';

function Pill({
  x,
  y,
  label,
  lit,
  dashed = false,
  delay = 0,
  tilt = 0,
  drift = 0,
}: {
  x: number;
  y: number;
  label: string;
  lit: boolean;
  dashed?: boolean;
  delay?: number;
  tilt?: number;
  /** Seconds for one slow drift loop; 0 keeps it still. */
  drift?: number;
}) {
  const t = 'transition-colors duration-500 motion-reduce:transition-none';
  return (
    <g>
      {drift > 0 && (
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 4 -5; -3 4; 0 0"
          dur={`${drift}s`}
          repeatCount="indefinite"
        />
      )}
      <g transform={`rotate(${tilt} ${x} ${y})`}>
        <rect
          x={x - PILL_W / 2}
          y={y - PILL_H / 2}
          width={PILL_W}
          height={PILL_H}
          rx={PILL_H / 2}
          strokeDasharray={dashed ? '4 4' : undefined}
          strokeWidth={1.2}
          className={`${t} ${lit ? 'fill-accent/15 stroke-accent/80' : 'fill-white/[0.05] stroke-white/15'}`}
          style={{ transitionDelay: `${delay}s` }}
        />
        <circle
          cx={x - PILL_W / 2 + 18}
          cy={y}
          r={3.6}
          className={`${t} ${lit ? 'fill-accent' : 'fill-white/25'}`}
          style={{ transitionDelay: `${delay}s` }}
        />
        <text
          x={x + 7}
          y={y + 5.5}
          textAnchor="middle"
          fontSize="15"
          fontWeight="500"
          className={`${t} ${lit ? 'fill-white' : 'fill-white/50'}`}
          style={{ transitionDelay: `${delay}s` }}
        >
          {label}
        </text>
      </g>
    </g>
  );
}

export function CompareFirms() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStill(true);
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="relative overflow-hidden bg-ink py-12 sm:py-20" aria-labelledby="compare-title">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[780px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_26%,transparent),transparent)]"
      />

      <PageContainer className="relative">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <Eyebrow dark>The difference</Eyebrow>
          <h2 id="compare-title" className="font-brand mt-3 text-heading text-white sm:text-section-title">
            Do the technical work.
          </h2>
          <h2 id="compare-title" className="font-brand mt-3 text-heading text-white sm:text-section-title">
            <span className="text-accent">Let GrowXQ handle the rest.</span>
          </h2>
        </div>

        {/* A hairline gradient edge around one glass card. */}
        <div
          ref={ref}
          className="mx-auto mt-8 max-w-[980px] rounded-[28px] bg-[linear-gradient(140deg,color-mix(in_oklab,var(--accent)_60%,transparent),color-mix(in_oklab,white_12%,transparent)_38%,color-mix(in_oklab,white_5%,transparent))] p-px shadow-[0_40px_90px_-40px_color-mix(in_oklab,var(--accent)_45%,transparent)] sm:mt-12"
        >
          <div className="grid divide-y divide-white/10 overflow-hidden rounded-[27px] bg-ink/90 md:grid-cols-2 md:divide-x md:divide-y-0">
            {/* Without */}
            <div className={`relative px-3 pb-4 pt-5 sm:px-5 sm:pb-6 ${DOTS}`}>
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/70">
                  <span className="size-1.5 rounded-full bg-white/40" />
                  Partners doing it all
                </span>
              </div>
              <svg
                viewBox="0 0 440 260"
                role="img"
                aria-label="Partners in a boutique firm doing everything themselves: tools, reach, networking, training, deals and recruiting, all separate."
                className="mx-auto mt-1 block h-auto w-full max-w-[460px]"
              >
                {AREAS.map((label, i) => (
                  <Pill
                    key={label}
                    x={SCATTER[i][0]}
                    y={SCATTER[i][1]}
                    label={label}
                    lit={false}
                    dashed
                    tilt={TILT[i]}
                    drift={still ? 0 : 7 + i * 1.3}
                  />
                ))}
              </svg>
            </div>

            {/* With */}
            <div className={`relative px-3 pb-4 pt-5 sm:px-5 sm:pb-6 ${DOTS}`}>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_58%,color-mix(in_oklab,var(--accent)_20%,transparent),transparent)]"
              />
              <div className="relative flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accent/15 px-3.5 py-1.5 text-xs font-semibold text-white">
                  <span className="size-1.5 rounded-full bg-accent" />
                  Partners focused on the work
                </span>
              </div>
              <svg
                viewBox="0 0 440 260"
                role="img"
                aria-label="Partners with GrowXQ: tools, reach, networking, training, deals and recruiting all handled through GrowXQ."
                className="relative mx-auto mt-1 block h-auto w-full max-w-[460px]"
              >
                <defs>
                  <radialGradient id="cf-halo">
                    <stop offset="0.35" style={{ stopColor: 'var(--accent)', stopOpacity: 0.45 }} />
                    <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
                  </radialGradient>
                </defs>

                {SPOKES.map((s, i) => {
                  const hubX = HUB.x + s.side * HUB.r;
                  const edge = s.x - s.side * (PILL_W / 2);
                  const d = `M ${hubX} ${HUB.y} C ${hubX + s.side * 30} ${HUB.y}, ${edge - s.side * 40} ${s.y}, ${edge} ${s.y}`;
                  const back = `M ${edge} ${s.y} C ${edge - s.side * 40} ${s.y}, ${hubX + s.side * 30} ${HUB.y}, ${hubX} ${HUB.y}`;
                  return (
                    <g key={AREAS[i]}>
                      <path
                        d={d}
                        pathLength={1}
                        fill="none"
                        className="stroke-accent/80 transition-[stroke-dashoffset] duration-[1100ms] ease-out motion-reduce:transition-none"
                        strokeWidth={1.4}
                        strokeLinecap="round"
                        style={{
                          strokeDasharray: 1,
                          strokeDashoffset: shown ? 0 : 1,
                          transitionDelay: `${0.2 + i * 0.1}s`,
                        }}
                      />
                      {shown && !still && (
                        <circle r={2.4} className="fill-white" opacity={0}>
                          <set attributeName="opacity" to="0.95" begin={`${1.6 + i * 0.35}s`} fill="freeze" />
                          <animateMotion
                            dur="2.8s"
                            begin={`${1.6 + i * 0.35}s`}
                            repeatCount="indefinite"
                            path={back}
                            calcMode="linear"
                          />
                        </circle>
                      )}
                    </g>
                  );
                })}

                <g
                  className="transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: shown ? 'scale(1)' : 'scale(0.6)',
                    opacity: shown ? 1 : 0,
                    transitionDelay: '0.1s',
                  }}
                >
                  <circle cx={HUB.x} cy={HUB.y} r={HUB.r * 2.1} fill="url(#cf-halo)" />
                  <circle
                    cx={HUB.x}
                    cy={HUB.y}
                    r={HUB.r * 1.45}
                    fill="none"
                    className="stroke-accent/25"
                    strokeWidth={1}
                  />
                  <circle cx={HUB.x} cy={HUB.y} r={HUB.r} className="fill-ink stroke-accent/70" strokeWidth={1.4} />
                  <svg
                    x={HUB.x - 13}
                    y={HUB.y - 13}
                    width={Math.round(26 * LOGO_MARK_ASPECT_RATIO)}
                    height={26}
                    viewBox="0 0 62 61"
                    overflow="hidden"
                    aria-hidden="true"
                  >
                    <image href={LOGO_SRC.dark} width="299" height="61" />
                  </svg>
                </g>

                {AREAS.map((label, i) => (
                  <Pill key={label} x={SPOKES[i].x} y={SPOKES[i].y} label={label} lit={shown} delay={0.9 + i * 0.12} />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
