'use client';

import { useEffect, useRef, useState } from 'react';

const DEFAULT_STAGE_INTERVAL_MS = 2600;
// Once the real fetch has finished, catch the ticker up to the last stage quickly instead of
// waiting out the remaining full-speed intervals — avoids both the jarring "cut off mid-sentence"
// look of unmounting early and a noticeably longer wait than the real work actually took.
const DEFAULT_CATCH_UP_INTERVAL_MS = 300;
const LINE_HEIGHT_PX = 32;

/**
 * Staged, cycling status ticker for a long-running async action (LinkedIn import, AI search, …)
 * where a static "Loading…" label reads as frozen over several seconds.
 *
 * Renders a 3-line clipped window (previous / active / next) that slides up one line at a time —
 * the pattern most AI product search/thinking indicators use, rather than a plain text swap.
 * Advances through `stages` on a timer and holds on the last one indefinitely rather than looping
 * or going blank, so it always reads as "still working," never "finished" or "stuck," regardless
 * of how long the actual request takes.
 *
 * `done` and `onReachedEnd` let a caller doing real async work behind this ticker avoid tearing
 * it down mid-stage the moment that work finishes: pass `done` once the real result is in, and
 * this component fast-forwards to the last stage (if it isn't there already) before calling
 * `onReachedEnd()` exactly once — that's the caller's cue that it's now safe to move on. A caller
 * that instead just unmounts this component the moment its own loading state flips (e.g. removing
 * it from a `status === 'loading' && (...)` block) can ignore both props.
 */
export function StagedTicker({
  stages,
  done = false,
  onReachedEnd,
  caption,
  stageIntervalMs = DEFAULT_STAGE_INTERVAL_MS,
  catchUpIntervalMs = DEFAULT_CATCH_UP_INTERVAL_MS,
}: {
  stages: string[];
  done?: boolean;
  onReachedEnd?: () => void;
  caption?: string;
  stageIntervalMs?: number;
  catchUpIntervalMs?: number;
}) {
  const [stageIndex, setStageIndex] = useState(0);
  const firedRef = useRef(false);
  const atEnd = stageIndex >= stages.length - 1;

  useEffect(() => {
    if (atEnd) return;
    const timer = setTimeout(() => setStageIndex((i) => i + 1), done ? catchUpIntervalMs : stageIntervalMs);
    return () => clearTimeout(timer);
  }, [stageIndex, atEnd, done, stageIntervalMs, catchUpIntervalMs]);

  useEffect(() => {
    if (atEnd && done && !firedRef.current) {
      firedRef.current = true;
      onReachedEnd?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atEnd, done]);

  return (
    <div className="flex flex-col items-center gap-5 py-14 text-center">
      {/* Clipped 3-line viewport — the inner list holds every stage and slides via transform so
          the transition between lines is a smooth scroll, not an abrupt content swap. */}
      <div className="relative w-full overflow-hidden" style={{ height: LINE_HEIGHT_PX * 3 }}>
        <div
          className="transition-transform duration-500 ease-out"
          style={{ transform: `translateY(${-(stageIndex - 1) * LINE_HEIGHT_PX}px)` }}
        >
          {stages.map((stage, i) => {
            const distance = i - stageIndex;
            return (
              <div
                key={stage}
                style={{ height: LINE_HEIGHT_PX }}
                className={`flex items-center justify-center whitespace-nowrap px-4 transition-all duration-500 ${
                  distance === 0
                    ? 'text-sm font-medium text-ink opacity-100 blur-0'
                    : Math.abs(distance) === 1
                      ? 'text-sm text-ink-3 opacity-40 blur-[1px]'
                      : 'opacity-0'
                }`}
              >
                {stage}
              </div>
            );
          })}
        </div>
      </div>

      {caption && <p className="text-xs text-ink-3">{caption}</p>}
    </div>
  );
}
