import type { ReactNode, Ref } from 'react';

// Literal class names so Tailwind generates them (never build `auto-cols-[${w}]` dynamically).
const ITEM_WIDTH = {
  '70%': 'auto-cols-[70%]',
  '82%': 'auto-cols-[82%]',
  '85%': 'auto-cols-[85%]',
  '86%': 'auto-cols-[86%]',
  '92%': 'auto-cols-[92%]',
  /** `scroll="always"` rows: most of a phone screen, a fixed card from `sm` up. */
  card: 'auto-cols-[82%] sm:auto-cols-[300px]',
} as const;

// Phones: a horizontal snap row that bleeds to the screen edges so the next card peeks in — the
// phone replacement for a stacked list of cards. From `sm` up it is a normal grid by default; pass
// that layout in `className` (e.g. "sm:grid-cols-2 sm:gap-5"). With `scroll="always"` it stays a
// horizontal snap row on every width (no edge bleed from `sm` up) — for a list that is browsed, not
// compared, like the profile's testimonials. Give each child `snap-start min-w-0`. Keyboard users
// can focus the region and scroll it with the arrow keys.
export function SwipeRow({
  label,
  itemWidth = '85%',
  scroll = 'phone',
  className = '',
  scrollRef,
  onScroll,
  children,
}: {
  /** Accessible name for the scroll region, e.g. "Upcoming events". */
  label: string;
  /** How much of the screen each card takes on phones; the rest shows the next card. */
  itemWidth?: keyof typeof ITEM_WIDTH;
  /** `phone` (default): grid from `sm` up. `always`: horizontal row on every width. */
  scroll?: 'phone' | 'always';
  className?: string;
  /** The scrolling element — for arrow buttons that page it (see `ReviewsTab`). */
  scrollRef?: Ref<HTMLDivElement>;
  onScroll?: () => void;
  children: ReactNode;
}) {
  const larger =
    scroll === 'always'
      ? 'sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0'
      : 'sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:overflow-visible sm:px-0 sm:pb-0';
  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      className={`-mx-5 grid snap-x snap-mandatory ${ITEM_WIDTH[itemWidth]} grid-flow-col gap-3 overflow-x-auto overscroll-x-contain scroll-px-5 px-5 pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${larger} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
