import type { ReactNode } from 'react';

// Splits items into row buckets, each an infinitely-scrolling, alternating-direction track.
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
        if (row.length === 0) return null;
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
