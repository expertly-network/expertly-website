import { Eyebrow } from '@/components/ui/Eyebrow';

// Written for the founding cohort: there are no real stats or testimonials yet, so instead of
// social proof the panel tells an applicant what a founding seat brings. Privileges mirror the
// PERKS list on /welcome.
const PRIVILEGES: [string, string][] = [
  ['Founding Member status', 'In before GrowXQ is public, a distinction nobody who joins later can have.'],
  ['Your first year, complimentary', 'Membership is on us for the whole of year one.'],
  [
    'First call on pricing and perks',
    'Every discount and benefit reaches founding members first, at its most generous.',
  ],
  ['The first look', 'See what we have built, and everything that comes with it, before anyone else.'],
];

// Desktop-only (>=1000px, matching auth.css's breakpoint) — hidden entirely on
// smaller viewports, same as the mockup.
export function AuthRightPanel() {
  return (
    <aside className="relative hidden items-center overflow-hidden bg-ink p-12 text-bg min-[1000px]:flex">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse at top right, color-mix(in oklab, var(--accent) 35%, transparent), transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div className="relative max-w-[520px]">
        <Eyebrow dark>Founding cohort · 100 seats</Eyebrow>
        <h2 className="mt-5 font-brand text-section-title font-normal text-balance text-white">
          You are applying for a <span className="text-accent">founding seat</span>.
        </h2>
        <p className="mt-4 text-lede text-white/70">Each seat is chosen by hand. Here is what it brings.</p>

        <ul className="mt-10 border-t border-white/[0.12]">
          {PRIVILEGES.map(([title, body]) => (
            <li key={title} className="flex gap-3 border-b border-white/[0.12] py-5">
              <svg
                viewBox="0 0 16 16"
                className="mt-1 h-4 w-4 flex-none text-accent"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <div className="text-base font-medium text-white">{title}</div>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
