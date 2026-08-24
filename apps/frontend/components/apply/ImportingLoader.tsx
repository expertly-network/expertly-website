'use client';

import { useEffect, useState } from 'react';

const STAGES = [
  'Connecting to your LinkedIn profile…',
  'Fetching your basic details…',
  'Reading your work experience…',
  'Reading your education history…',
  'Organizing everything for you…',
  'Almost done…',
];

const STAGE_INTERVAL_MS = 2600;
const LINE_HEIGHT_PX = 32;

/**
 * Staged, cycling status ticker for a long-running background fetch. LinkedIn import today —
 * the mock provider simulates realistic latency (see mock-linkedin-import.provider.ts) because
 * the real n8n-backed one may take anywhere from a few seconds to a couple of minutes, and a
 * static "Importing…" label reads as frozen over that span.
 *
 * Renders a 3-line clipped window (previous / active / next) that slides up one line at a time —
 * the same "AI search" ticker pattern most AI product search/thinking indicators use, rather than
 * a plain text swap. Advances through STAGES on a timer and holds on the last one indefinitely
 * rather than looping or going blank, so it always reads as "still working," never "finished" or
 * "stuck," regardless of how long the actual request takes.
 */
export function ImportingLoader() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (stageIndex >= STAGES.length - 1) return;
    const timer = setTimeout(() => setStageIndex((i) => i + 1), STAGE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [stageIndex]);

  return (
    <div className="flex flex-col items-center gap-5 py-14 text-center">
      {/* Clipped 3-line viewport — the inner list holds every stage and slides via transform so
          the transition between lines is a smooth scroll, not an abrupt content swap. */}
      <div className="relative w-full overflow-hidden" style={{ height: LINE_HEIGHT_PX * 3 }}>
        <div
          className="transition-transform duration-500 ease-out"
          style={{ transform: `translateY(${-(stageIndex - 1) * LINE_HEIGHT_PX}px)` }}
        >
          {STAGES.map((stage, i) => {
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

      <p className="text-xs text-ink-3">
        This can take anywhere from a few seconds to a couple of minutes.
      </p>
    </div>
  );
}
