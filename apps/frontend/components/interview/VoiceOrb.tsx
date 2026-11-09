'use client';

import { useEffect, useRef } from 'react';

export type OrbMode = 'connecting' | 'agent' | 'listening';

const SIZE = { sm: 'h-12 w-12', lg: 'h-60 w-60' } as const;
const COLOUR: Record<OrbMode, { core: string; halo: string; ring: string }> = {
  agent: { core: 'bg-accent', halo: 'bg-accent/20', ring: 'bg-accent/10' },
  listening: { core: 'bg-ink', halo: 'bg-ink/10', ring: 'bg-ink/5' },
  connecting: { core: 'bg-line-2', halo: 'bg-line/60', ring: 'bg-line/40' },
};

// Reacts to whoever is talking: the interviewer's output volume while it speaks, the member's mic
// volume while listening. The scale is written straight to the element every animation frame, so
// the orb never re-renders React. Static (no pulse, no scaling) under prefers-reduced-motion.
export function VoiceOrb({ mode, level, size = 'lg' }: { mode: OrbMode; level: () => number; size?: 'sm' | 'lg' }) {
  const core = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const tick = () => {
      const v = Math.min(1, Math.max(0, level()));
      if (core.current) core.current.style.transform = `scale(${1 + v * 0.45})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [level]);

  const c = COLOUR[mode];
  return (
    <div className={`relative flex shrink-0 items-center justify-center ${SIZE[size]}`} aria-hidden="true">
      <div
        className={`absolute inset-0 rounded-full ${c.ring} ${mode === 'connecting' ? '' : 'motion-safe:animate-pulse'}`}
      />
      <div className={`absolute inset-[18%] rounded-full ${c.halo}`} />
      <div
        ref={core}
        className={`relative h-1/2 w-1/2 rounded-full ${c.core} transition-[transform,background-color] duration-100`}
      />
    </div>
  );
}
