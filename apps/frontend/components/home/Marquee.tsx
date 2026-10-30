import type { ReactNode } from 'react';

// Shared tile height for the homepage marquees (Featured Members, Coverage categories) so their
// cards line up at the same size. Full class string so Tailwind's scanner picks it up.
export const MARQUEE_TILE_HEIGHT = 'h-[97px]';

// Splits items into row buckets, each an infinitely-scrolling, alternating-direction track.
//
// `fill` mode (for fixed-width tiles): every row gets exactly the same number of items, repeating
// the list as needed so a short list still covers the whole track with no gaps, and every row
// shares one duration — equal length + equal duration = all rows move at the same speed.
export function Marquee<T>({
  items,
  rows,
  speeds,
  fill,
  renderItem,
  itemKey,
}: {
  items: T[];
  rows: number;
  speeds?: number[];
  /** minPerRow: tiles per row before doubling; secondsPerItem: time for one tile to scroll past. */
  fill?: { minPerRow: number; secondsPerItem: number };
  renderItem: (item: T) => ReactNode;
  itemKey: (item: T) => string;
}) {
  let buckets: T[][];
  let durationFor: (ri: number) => number;

  if (fill && items.length > 0) {
    const share = Math.ceil(items.length / rows);
    const perRow = Math.max(fill.minPerRow, share);
    // Each row starts at its own offset in the list so stacked rows don't line up the same
    // member, and cycles from there — consecutive tiles differ whenever there are 2+ items.
    buckets = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: perRow }, (_, j) => items[(r * share + j) % items.length])
    );
    const duration = perRow * fill.secondsPerItem;
    durationFor = () => duration;
  } else {
    buckets = Array.from({ length: rows }, () => []);
    items.forEach((item, i) => buckets[i % rows].push(item));
    const list = speeds && speeds.length > 0 ? speeds : [50];
    durationFor = (ri) => list[ri % list.length];
  }

  return (
    <div className="marquee-fade flex flex-col gap-3 overflow-hidden">
      {buckets.map((row, ri) => {
        if (row.length === 0) return null;
        const doubled = [...row, ...row];
        return (
          <div key={ri} className={`overflow-hidden ${ri % 2 ? 'marquee-row-reverse' : ''}`}>
            <div className="marquee-track flex w-max gap-3" style={{ animationDuration: `${durationFor(ri)}s` }}>
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
