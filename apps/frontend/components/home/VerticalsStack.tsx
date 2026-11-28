import type { Vertical } from '@/components/home/verticals-data';

// Six cards stacking as you scroll (the user benefits in UserBenefits). Every card sticks a little lower than the one before it, so
// each earlier card stays visible as a thin bar (its header) with the next card sliding over the
// body. Pure CSS (position: sticky): no script, nothing to load. The header height and the sticky
// step are the same variable, so the bars always line up exactly.
//
// A sticky card is released when the end of the stack reaches its bottom edge. For the finished
// stack to leave as one block, every card needs (sticky top + height + bottom margin) equal, so each
// card gets a bottom margin one step larger than the next, cancelled by a negative top margin on the
// next card, which then adds a --gap of space between the cards.
//
// Sizes: --base is the first card's sticky top (just under the mobile top bar below lg, 24px on
// desktop), --step the bar height, --h the card height, --gap the space between cards. Keep them as
// plain px values. Phones get a shorter --h (sized to the tallest card's content at 320px / 400px,
// re-measure if copy grows) so a card isn't a third empty; from `sm` it's the original 340px.

// Literal class names so Tailwind generates them (never build them at runtime).
const LAYERS = [
  {
    card: 'bg-[linear-gradient(135deg,var(--accent-2),color-mix(in_oklab,var(--accent)_40%,black))] text-white',
    mute: 'text-white/75',
    rule: 'border-white/20',
    num: 'text-white/15',
    tick: 'text-white',
  },
  {
    card: 'border border-white/10 bg-[color-mix(in_oklab,var(--ink)_90%,white)] text-white',
    mute: 'text-white/70',
    rule: 'border-white/15',
    num: 'text-white/10',
    tick: 'text-accent',
  },
  {
    card: 'border border-line bg-bg-card text-ink',
    mute: 'text-ink-3',
    rule: 'border-line',
    num: 'text-ink/[0.06]',
    tick: 'text-accent',
  },
  {
    card: 'bg-neon text-ink',
    mute: 'text-ink-2',
    rule: 'border-accent/25',
    num: 'text-ink/[0.07]',
    tick: 'text-accent',
  },
  {
    card: 'border border-white/10 bg-[color-mix(in_oklab,var(--ink)_90%,white)] text-white',
    mute: 'text-white/70',
    rule: 'border-white/15',
    num: 'text-white/10',
    tick: 'text-accent',
  },
  {
    card: 'border border-line bg-bg-card text-ink',
    mute: 'text-ink-3',
    rule: 'border-line',
    num: 'text-ink/[0.06]',
    tick: 'text-accent',
  },
] as const;

export function VerticalsStackCards({ verticals }: { verticals: readonly Vertical[] }) {
  return (
    <div className="flex flex-col [--base:77px] [--gap:36px] [--h:310px] [--step:54px] min-[400px]:[--h:288px] sm:[--gap:40px] sm:[--h:340px] sm:[--step:58px] lg:[--base:24px]">
      {verticals.map((v, i) => {
        const t = LAYERS[i % LAYERS.length];
        return (
          <article
            key={v.title}
            className={`sticky flex flex-col overflow-hidden rounded-3xl shadow-[0_-18px_40px_-24px_color-mix(in_oklab,black_55%,transparent)] ${t.card}`}
            style={{
              top: `calc(var(--base) + ${i} * var(--step))`,
              height: 'var(--h)',
              marginBottom: `calc(${verticals.length - 1 - i} * var(--step))`,
              // Cancel the previous card's margin, then leave a --gap between the cards.
              marginTop: i === 0 ? undefined : `calc(${i - verticals.length} * var(--step) + var(--gap))`,
            }}
          >
            {/* The bar that stays visible once the next layer covers the body. */}
            <header
              className={`flex h-[var(--step)] items-center justify-between gap-3 border-b px-5 sm:px-8 ${t.rule}`}
            >
              <div className="flex min-w-0 items-baseline gap-3">
                <span className={`font-mono text-xs ${t.mute}`}>{String(i + 1).padStart(2, '0')}</span>
                <h3 className="font-brand truncate text-title">{v.title}</h3>
              </div>
            </header>

            <div className="relative grid flex-1 content-start gap-4 px-5 pb-6 pt-5 sm:gap-5 sm:px-8 sm:pb-10 sm:pt-8">
              <span
                aria-hidden="true"
                className={`font-brand pointer-events-none absolute -bottom-6 right-4 select-none text-[120px] leading-none sm:right-8 sm:text-[190px] ${t.num}`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="font-brand relative text-title sm:max-w-[26ch] sm:text-heading">{v.promise}</p>
              <ul className={`relative flex flex-col gap-2 text-sm sm:gap-2.5 sm:text-[15px] ${t.mute}`}>
                {v.outcomes.map((o) => (
                  <li key={o} className="flex items-start gap-3">
                    <span aria-hidden="true" className={`mt-0.5 flex-none ${t.tick}`}>
                      ✓
                    </span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
              {/* An optional one-line invite under the points, e.g. asking vendors to pitch a product. */}
              {v.aside && (
                <p className={`relative text-sm sm:text-[15px] ${t.mute}`}>
                  {v.aside.text}{' '}
                  <a
                    href={v.aside.href}
                    className="whitespace-nowrap font-medium text-accent underline-offset-4 hover:underline"
                  >
                    {v.aside.linkLabel} →
                  </a>
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
