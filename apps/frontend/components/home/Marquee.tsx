import type { ReactNode } from 'react';

// Splits `items` into `rows` buckets (round-robin, matching home.js's row assignment) and
// renders each as an infinitely-scrolling track — alternating direction per row, content
// duplicated so the loop is seamless. `speeds` cycles per row, matching the design's own
// per-row speed variation so rows don't all drift in lockstep.
export function Marquee<T>({
  items,
  rows,
  speeds,
  renderItem,
  itemKey,
}: {
  items: T[];
  rows: number;
  speeds: number[];
  renderItem: (item: T) => ReactNode;
  itemKey: (item: T) => string;
}) {
  const buckets: T[][] = Array.from({ length: rows }, () => []);
  items.forEach((item, i) => buckets[i % rows].push(item));

  return (
    <div className="marquee-fade flex flex-col gap-3 overflow-hidden">
      {buckets.map((row, ri) => {
        const doubled = [...row, ...row];
        return (
          <div key={ri} className={`overflow-hidden ${ri % 2 ? 'marquee-row-reverse' : ''}`}>
            <div
              className="marquee-track flex w-max gap-3"
              style={{ animationDuration: `${speeds[ri % speeds.length]}s` }}
            >
              {doubled.map((item, i) => (
                <div key={`${itemKey(item)}-${i}`}>{renderItem(item)}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
