'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { AreaIcon } from '@/components/home/verticals-icons';

// The orbit: a hub, six icon nodes on a dashed ring joined to it by hairline spokes, and an accent arc
// that closes the circle at the last area. It is the quiet partner of the layer
// cards beside it, so it only moves when you scroll: no idle animation competes with the text.
// Every area starts grey. As you reach an area its node lights green and stays green, and the
// active one is filled. Scroll sets a target position (0 to 5) and how far in the section is
// ("lit", 0 to 1); a spring pulls the ring toward the position, turning it clockwise. Everything is
// written straight to the elements in one frame loop, so React never re-renders per frame.
// Node and label sizes follow the dial's own width (container units), not the window's, so they
// keep their proportions however small the dial gets (e.g. a zoomed-in browser).

type Props = {
  labels: readonly string[];
  /** Target position set by scroll, 0 to (labels.length - 1). Read every frame. */
  posRef: MutableRefObject<number>;
  /** 0 before the section is reached, 1 once the first layer is in place. Read every frame. */
  litRef: MutableRefObject<number>;
  /** The active area, or -1 while nothing is lit yet. */
  active: number;
  /** Only run the frame loop while the section is on screen. */
  visible: boolean;
  /** Called when an area is clicked or chosen with the keyboard. */
  onSelect: (index: number) => void;
};

const SPOTLIGHT = -90; // degrees: the active node sits at the top
const STEP = 60; // degrees between nodes
const RADIUS = 32; // ring the node+label units are centred on, percent of the box
const OUTER = 45.5; // progress arc
const HUB = 8; // hub radius (the hub div is 16% wide)
const STIFFNESS = 280; // spring constants: critically damped and quick, so the dial never trails the cards
const DAMPING = 33;
const ARC = 2 * Math.PI * OUTER;

const rad = (d: number) => (d * Math.PI) / 180;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function VerticalsOrbit({ labels, posRef, litRef, active, visible, onSelect }: Props) {
  const count = labels.length;
  const nodes = useRef<(HTMLButtonElement | null)[]>([]);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const halos = useRef<(HTMLSpanElement | null)[]>([]);
  const links = useRef<(SVGLineElement | null)[]>([]);
  const progress = useRef<SVGCircleElement>(null);
  const head = useRef<SVGGElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const core = useRef<HTMLSpanElement>(null);
  const motion = useRef({ pos: posRef.current, vel: 0 });
  const box = useRef<HTMLDivElement>(null);
  // Each node and its name form one unit centred on the ring, so the ring stays balanced top to
  // bottom. The circle sits above the unit's centre by `lift` (percent of the box), and spokes aim
  // at the circle's own centre. Measured from the DOM on mount and on resize.
  const geo = useRef({ lift: 3, nodeR: 5.6 });

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();

    const measure = () => {
      const size = box.current?.offsetWidth;
      const unit = nodes.current[0];
      const circle = unit?.firstElementChild;
      if (!size || !unit || !(circle instanceof HTMLElement)) return;
      geo.current = {
        lift: ((unit.offsetHeight - circle.offsetHeight) / 2 / size) * 100,
        nodeR: (circle.offsetWidth / 2 / size) * 100,
      };
    };
    measure();
    window.addEventListener('resize', measure);

    const draw = () => {
      const { pos } = motion.current;
      const lit = litRef.current;
      for (let i = 0; i < count; i++) {
        // Angle grows with scroll, so the ring turns clockwise on screen.
        const a = rad(SPOTLIGHT + (pos - i) * STEP);
        const c = Math.cos(a);
        const sn = Math.sin(a);
        const near = clamp01(1 - Math.abs(pos - i)) * lit;
        const scale = 0.9 + near * 0.2;
        const node = nodes.current[i];
        if (node) {
          node.style.left = `${50 + RADIUS * c}%`;
          node.style.top = `${50 + RADIUS * sn}%`;
          node.style.transform = `translate(-50%, -50%) scale(${scale})`;
          node.style.zIndex = String(Math.round(near * 10));
        }
        const fill = fills.current[i];
        if (fill) fill.style.opacity = String(near);
        const halo = halos.current[i];
        if (halo) halo.style.opacity = String(near);
        const link = links.current[i];
        if (link) {
          // From the hub's edge to just short of the circle's centre (lifted above the unit centre).
          const { lift, nodeR } = geo.current;
          const dx = RADIUS * c;
          const dy = RADIUS * sn - lift * scale;
          const d = Math.hypot(dx, dy) || 1;
          const end = d - nodeR * scale - 0.8;
          link.setAttribute('x1', String(50 + (dx / d) * (HUB + 1)));
          link.setAttribute('y1', String(50 + (dy / d) * (HUB + 1)));
          link.setAttribute('x2', String(50 + (dx / d) * end));
          link.setAttribute('y2', String(50 + (dy / d) * end));
          link.style.opacity = String(0.1 + near * 0.8);
        }
      }

      // The arc fills clockwise and closes the full circle at the last area; a bright head leads it.
      const share = count > 1 ? pos / (count - 1) : 1;
      if (progress.current) progress.current.style.strokeDashoffset = String(ARC * (1 - share));
      const ha = rad(SPOTLIGHT + share * 360);
      if (head.current) {
        head.current.setAttribute('transform', `translate(${50 + OUTER * Math.cos(ha)} ${50 + OUTER * Math.sin(ha)})`);
        head.current.style.opacity = String(lit);
      }
      // The hub's light comes up as the section is reached.
      if (glow.current) glow.current.style.opacity = String(0.25 + lit * 0.75);
      if (core.current) core.current.style.opacity = String(0.3 + lit * 0.7);
    };

    const tick = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const m = motion.current;
      if (reduce) {
        m.pos = posRef.current;
        m.vel = 0;
      } else {
        // Spring toward the scroll target. Sub-stepped so a slow frame can't make it unstable.
        const steps = Math.max(1, Math.ceil(dt / 0.008));
        const h = dt / steps;
        for (let k = 0; k < steps; k++) {
          m.vel += (STIFFNESS * (posRef.current - m.pos) - DAMPING * m.vel) * h;
          m.pos += m.vel * h;
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    draw();
    if (visible) raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [count, posRef, litRef, visible]);

  return (
    <div ref={box} className="relative size-full [container-type:inline-size]">
      {/* Light comes from the hub, not from a corner. */}
      <div
        ref={glow}
        aria-hidden="true"
        className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--accent)_20%,transparent),color-mix(in_oklab,var(--accent)_5%,transparent)_45%,transparent_70%)] opacity-25"
      />
      <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
        <circle
          ref={progress}
          cx="50"
          cy="50"
          r={OUTER}
          fill="none"
          className="stroke-accent"
          strokeWidth={0.5}
          strokeLinecap="round"
          strokeDasharray={ARC}
          strokeDashoffset={ARC}
          transform="rotate(-90 50 50)"
        />
        <g ref={head} opacity={0}>
          <circle r={2.6} className="fill-accent" opacity={0.15} />
          <circle r={0.9} className="fill-white" />
        </g>
        {/* Spokes from the hub to each area; the active one turns green. */}
        {labels.map((label, i) => (
          <line
            key={label}
            ref={(el) => {
              links.current[i] = el;
            }}
            x1="50"
            y1="50"
            x2="50"
            y2="50"
            className={i === active ? 'stroke-accent' : 'stroke-white'}
            strokeWidth={i === active ? 0.35 : 0.18}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* The hub: a glass core with a soft light inside. */}
      <div className="absolute left-1/2 top-1/2 flex size-[16%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_50%_35%,color-mix(in_oklab,white_10%,transparent),color-mix(in_oklab,white_2%,transparent)_70%)] shadow-[inset_0_1px_0_color-mix(in_oklab,white_14%,transparent)]">
        <span
          ref={core}
          className="size-[30%] rounded-full bg-[radial-gradient(circle,white,var(--accent)_45%,transparent_75%)] opacity-30"
        />
      </div>

      {labels.map((label, i) => {
        // Grey until reached; green once reached; filled while active.
        const state = i === active ? 'active' : active >= 0 && i < active ? 'reached' : 'idle';
        return (
          <button
            type="button"
            key={label}
            ref={(el) => {
              nodes.current[i] = el;
            }}
            onClick={() => onSelect(i)}
            aria-label={`Go to ${label}`}
            aria-current={i === active ? 'step' : undefined}
            className={`group absolute flex cursor-pointer flex-col items-center gap-2 rounded-xl p-1 transition-opacity duration-500 will-change-transform hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${state === 'idle' ? 'opacity-50' : 'opacity-100'}`}
          >
            <span
              className={`relative flex size-[clamp(34px,15cqw,52px)] items-center justify-center rounded-full border bg-ink transition-colors duration-500 ${
                state === 'active'
                  ? 'border-transparent text-white'
                  : state === 'reached'
                    ? 'border-accent/50 text-accent'
                    : 'border-white/10 text-white/45 group-hover:border-white/30 group-hover:text-white/80'
              }`}
            >
              {/* Soft halo behind the active node. */}
              <span
                ref={(el) => {
                  halos.current[i] = el;
                }}
                aria-hidden="true"
                className="absolute -inset-[45%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--accent)_40%,transparent),transparent_65%)] opacity-0"
              />
              <span
                ref={(el) => {
                  fills.current[i] = el;
                }}
                aria-hidden="true"
                className="absolute -inset-px rounded-full bg-[linear-gradient(150deg,color-mix(in_oklab,var(--accent)_65%,white),var(--accent)_55%,color-mix(in_oklab,var(--accent)_80%,black))] shadow-[inset_0_1px_0_color-mix(in_oklab,white_35%,transparent)] opacity-0"
              />
              <AreaIcon index={i} className="relative size-[48%]" />
            </span>
            <span
              className={`whitespace-nowrap text-[clamp(10px,4cqw,12px)] tracking-wide transition-colors duration-500 [text-shadow:0_1px_8px_var(--ink),0_0_2px_var(--ink)] ${
                state === 'active' ? 'font-semibold text-white' : state === 'reached' ? 'text-accent' : 'text-white/70'
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
