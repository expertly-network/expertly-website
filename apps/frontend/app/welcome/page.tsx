import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LogoImage } from '@/components/Logo';
import { isSiteLaunched } from '@/lib/env';
import { FOUNDING_COUPON_CODE } from '@/lib/launch';

// The pre-launch teaser. middleware.ts serves it at `/` while SITE_LAUNCHED=false, so invitees see
// this instead of the home page. It's written to the founding cohort: a held seat, what founding
// members receive, and one way in, the application. Once launched it doesn't exist.

export const metadata = {
  title: 'Hi, Founding Member! Your seat at the table is held, for now!',
  description: 'GrowXQ founding cohort: 100 seats, first year complimentary.',
  robots: { index: false, follow: false },
};

// This page's dark palette, derived from the two brand tokens (--ink, --accent) rather than new hexes:
// near-black surfaces with a faint green cast, and a pale mint for the CTA hover.
const PALETTE = {
  '--wl-panel': 'color-mix(in oklab, var(--accent) 4%, color-mix(in oklab, white 5%, var(--ink)))',
  '--wl-line': 'color-mix(in oklab, var(--accent) 10%, color-mix(in oklab, white 13%, var(--ink)))',
  '--wl-line-soft': 'color-mix(in oklab, var(--accent) 7%, color-mix(in oklab, white 8%, var(--ink)))',
  '--wl-dot': 'color-mix(in oklab, var(--accent) 12%, color-mix(in oklab, white 15%, var(--ink)))',
  '--wl-text': 'color-mix(in oklab, var(--accent) 4%, white)',
  '--wl-mint': 'color-mix(in oklab, var(--accent) 50%, white)',
} as CSSProperties;

const SECTION = 'mx-auto box-border w-full max-w-[1200px] px-[clamp(20px,5vw,64px)]';
const SECTION_Y = 'py-[72px] sm:py-[clamp(56px,8vw,112px)]';
const LABEL = 'text-label uppercase tracking-[0.16em]';

const PERKS: [string, string][] = [
  ['Founding Member status', 'You are in before it is public. That is a distinction nobody who joins later can have.'],
  [
    'Your first year, complimentary',
    'Membership is on us for the whole of year one. It is our thanks for trusting something that does not exist yet.',
  ],
  [
    'First call on pricing and perks',
    'Any discount or pricing benefit goes to founding members first, and at its most generous. It narrows for those who join later.',
  ],
  [
    'The first look',
    'Once the cohort is formed, you see what we have built, and everything that comes with it, before anyone else does.',
  ],
];

const CATEGORY_EXAMPLES: string[][] = [
  ['Tax', 'Direct Tax', 'International Tax'],
  ['Legal', 'Sector Specific', 'Aviation'],
];

const SEATS = 100;
// The seat lit up in the cohort grid: "yours", deliberately not the first.
const YOUR_SEAT = 36;

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className={`flex items-center gap-3 text-accent ${LABEL}`}>
      <span aria-hidden="true" className="inline-block h-px w-7 bg-accent" />
      {children}
    </div>
  );
}

function FoundingSeatCta() {
  return (
    <Link
      href={`/apply?coupon=${FOUNDING_COUPON_CODE}`}
      className="inline-flex min-h-[56px] max-sm:w-full max-sm:justify-center max-sm:px-5 items-center gap-3 rounded px-8 text-[17px] font-semibold text-ink transition-[background-color,transform] duration-150 bg-accent hover:-translate-y-px hover:bg-[var(--wl-mint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--wl-text)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      Claim your founding seat <span aria-hidden="true">&rarr;</span>
    </Link>
  );
}

// Widths of the redacted lines on the sealed-preview card.
const REDACTED = ['92%', '74%', '84%', '48%'];

function LockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function XqTagline({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      Professionals with <span className="text-accent">X</span>ceptional <span className="text-accent">Q</span>uotient
    </span>
  );
}

export default function WelcomePage() {
  if (isSiteLaunched()) notFound();

  return (
    <main
      style={PALETTE}
      className="min-h-[100dvh] bg-ink text-[17px] leading-[1.6] max-sm:leading-[1.75] text-[var(--wl-text)]"
    >
      {/* Top bar */}
      <header className={`${SECTION} flex items-start justify-between gap-3 py-6 sm:items-center sm:gap-6 sm:py-7`}>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <LogoImage surface="dark" height={44} className="max-sm:![--logo-h:32px]" priority />
        </div>
        <nav
          aria-label="Invitation"
          className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4"
        >
          <span className="order-last text-[10px] leading-normal text-white/60 sm:order-none sm:text-eyebrow sm:uppercase sm:tracking-[0.12em]">
            <span className="hidden sm:inline">By invitation only</span>
            <span className="sm:hidden">Invitation only</span>
          </span>
          <Link
            href="/login"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded border border-[var(--wl-line)] px-4 text-label font-medium text-[var(--wl-text)] transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            Sign in{' '}
            <span aria-hidden="true" className="ml-2">
              &rarr;
            </span>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section
        className={`${SECTION} flex flex-wrap items-center gap-x-16 gap-y-14 max-sm:gap-y-16 pb-[clamp(56px,8vw,112px)] max-sm:pb-[72px] pt-[clamp(24px,5vw,72px)] max-sm:pt-10`}
      >
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-8">
          <Eyebrow>Hi, Founding Member</Eyebrow>
          <h1 className="m-0 font-brand text-[clamp(38px,4.8vw,68px)] font-normal leading-[1.06] tracking-[-0.02em] text-balance">
            Something is being built for <span className="text-accent">Professionals, like you</span>
          </h1>
          <p className="m-0 max-w-[540px] text-[clamp(17px,1.6vw,20px)] text-white/70 text-pretty">
            We are seating a founding cohort of up to 100 professionals, each one chosen by hand. What we are building
            stays private until the cohort is formed, and you will see it before anyone else does.
          </p>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-5 max-sm:flex-col max-sm:items-stretch max-sm:pt-2">
            <FoundingSeatCta />
            <p className="m-0 text-sm leading-normal text-white/55 max-sm:text-center">
              Takes Max 5 mins
              <br />
              First year complimentary.
            </p>
          </div>
        </div>

        {/* The held seat: a sealed preview, revealed when the founding cohort forms. */}
        <div className="mx-auto w-full min-w-0 flex-[0_1_400px]">
          <div className="flex flex-col gap-8 overflow-hidden rounded-md border border-line bg-bg-alt bg-[radial-gradient(120%_70%_at_100%_0%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_60%)] text-ink p-7 shadow-[0_0_0_8px_color-mix(in_oklab,white_3%,var(--ink))]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <LogoImage surface="light" height={24} />
              <span className="rounded-sm border border-accent px-2.5 py-1 text-eyebrow uppercase tracking-[0.14em] text-accent">
                Founding Member
              </span>
            </div>

            <div className="flex items-center gap-5 pb-1.5 pt-3">
              <span
                aria-hidden="true"
                className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-[0_0_0_6px_color-mix(in_oklab,var(--accent)_14%,transparent),0_10px_24px_-8px_color-mix(in_oklab,var(--accent)_55%,transparent)]"
              >
                <span className="absolute inset-0 rounded-full border-2 border-accent opacity-50 motion-safe:animate-ping" />
                <svg
                  className="relative"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <span className="font-brand text-[clamp(34px,4vw,48px)] leading-[1.06] tracking-[-0.02em]">
                Your seat
                <br />
                is <em className="not-italic text-accent-2">held.</em>
              </span>
            </div>

            <div className="flex flex-col gap-4 border-t border-line pt-6">
              <div className="flex items-center justify-between gap-3 text-eyebrow uppercase tracking-[0.16em] text-ink-3">
                <span>What is inside</span>
                <LockIcon />
              </div>
              <div aria-hidden="true" className="flex flex-col gap-2.5">
                {REDACTED.map((w) => (
                  <span key={w} className="h-2.5 rounded-sm bg-line-2" style={{ width: w }} />
                ))}
              </div>
              <p className="m-0 text-caption text-ink-3">Revealed to the founding cohort first.</p>
            </div>

            <div className="flex items-center justify-between gap-4 text-eyebrow uppercase tracking-[0.12em] text-ink-3">
              <span>Seat of 100</span>
              <span>Year one on us</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tagline band */}
      <section className="border-y border-[var(--wl-line-soft)] bg-[var(--wl-panel)]">
        <div className={`${SECTION} ${SECTION_Y} flex flex-col gap-5 max-sm:gap-7`}>
          <div className={`${LABEL} text-white/55`}>What the name stands for</div>
          <p className="m-0 font-brand text-[clamp(30px,4.2vw,50px)] leading-[1.06] tracking-[-0.02em] sm:whitespace-nowrap">
            <XqTagline />.
          </p>
          <p className="m-0 max-w-[560px] text-white/70 text-pretty">
            It is the room we want to build: people whose work speaks for itself, and who would rather be known for it
            than advertise it.
          </p>
        </div>
      </section>

      {/* What founding means */}
      <section className={`${SECTION} ${SECTION_Y} flex flex-col gap-12 max-sm:gap-10`}>
        <div className="flex flex-col gap-5">
          <Eyebrow>Founding member privileges</Eyebrow>
          <h2 className="m-0 max-w-[760px] font-brand text-headline font-normal text-balance">
            What founding members receive
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-x-16 gap-y-9 rounded-md border border-[var(--wl-line)] bg-[var(--wl-panel)] p-[clamp(24px,4vw,48px)]">
          <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5 max-sm:gap-5">
            <div className={`${LABEL} text-white/55`}>Priority over your category</div>
            <p className="m-0 font-brand text-[clamp(26px,3vw,36px)] leading-[1.18] tracking-[-0.015em] text-accent text-balance">
              Claim your specialism before anyone else does.
            </p>
            <p className="m-0 text-white/70 text-pretty">
              Choose the category you want to be known for, as specific as you like. Each category admits only a limited
              number of professionals, and once yours is allotted it is held for you. No competition, no overlap.
            </p>
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <div className="text-eyebrow uppercase tracking-[0.16em] text-white/55">For example</div>
            {CATEGORY_EXAMPLES.map((path) => (
              <ol key={path[0]} className="m-0 flex list-none flex-wrap items-center gap-2.5 p-0">
                {path.map((step, i) => {
                  const last = i === path.length - 1;
                  return (
                    <li key={step} className="flex items-center gap-2.5">
                      <span
                        className={`rounded border px-4 py-2.5 text-[15px] ${
                          last
                            ? 'border-accent bg-accent font-semibold text-ink'
                            : 'border-[var(--wl-line)] font-medium text-white/70'
                        }`}
                      >
                        {step}
                      </span>
                      {!last && (
                        <span aria-hidden="true" className="text-white/55">
                          &rsaquo;
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            ))}
            <div className="flex items-center gap-2.5 text-caption font-medium uppercase tracking-[0.12em] text-accent">
              <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
              Allotted to you
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-8 min-[560px]:gap-y-4 min-[560px]:grid-cols-2 min-[860px]:grid-cols-4">
          {PERKS.map(([title, body]) => (
            <div
              key={title}
              className="flex min-w-0 flex-col gap-3 max-sm:gap-4 border-t border-[var(--wl-line)] pb-3 pt-7"
            >
              <h3 className="m-0 font-brand text-[20px] font-normal leading-[1.25] tracking-[-0.01em] text-accent min-[860px]:min-h-[3.75em] min-[1040px]:min-h-[2.5em]">
                {title}
              </h3>
              <p className="m-0 text-base text-white/70 text-pretty">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The cohort */}
      <section className="border-y border-[var(--wl-line-soft)] bg-[var(--wl-panel)]">
        <div className={`${SECTION} ${SECTION_Y} flex flex-wrap items-center gap-x-20 gap-y-14`}>
          <div className="flex min-w-0 flex-[1_1_400px] flex-col items-start gap-6 max-sm:gap-8">
            <Eyebrow>The cohort</Eyebrow>
            <h2 className="m-0 font-brand text-headline font-normal text-balance">One hundred seats. Not one more.</h2>
            <p className="m-0 max-w-[500px] text-white/70 text-pretty">
              Every founding seat is assigned by invitation. When the last one is taken, the cohort closes, and
              membership opens to everyone else behind you.
            </p>
            <p className="m-0 box-border w-full max-w-[500px] border-t border-[var(--wl-line)] pt-6 text-[15px] text-white/55 text-pretty">
              Seats go in the order applications are completed.
            </p>
            <FoundingSeatCta />
          </div>
          <div aria-hidden="true" className="mx-auto flex-none">
            <div className="grid grid-cols-[repeat(10,16px)] gap-3">
              {Array.from({ length: SEATS }, (_, i) => (
                <span
                  key={i}
                  className={`h-4 w-4 rounded-full ${
                    i === YOUR_SEAT
                      ? 'bg-accent shadow-[0_0_0_5px_var(--wl-panel),0_0_0_6px_var(--accent)]'
                      : 'bg-[var(--wl-dot)]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className={`${SECTION} grid grid-cols-1 items-center gap-x-8 gap-y-3.5 max-sm:gap-y-6 pb-5 pt-6 max-sm:py-10 min-[700px]:grid-cols-[1fr_auto]`}
      >
        <LogoImage surface="dark" height={36} className="max-[600px]:![--logo-h:30px]" />
        <p className="m-0 text-caption text-white/55 min-[700px]:text-right">
          Questions? Write to{' '}
          <a
            href="mailto:ask@growxq.com"
            className="border-b border-accent text-[var(--wl-text)] transition-colors hover:text-accent"
          >
            ask@growxq.com
          </a>
        </p>
        <p className="m-0 text-label font-normal leading-normal text-white/50">
          The platform is designed to comply with applicable professional conduct rules.{' '}
          <Link href="/legal/terms" className="underline-offset-2 hover:text-white/80 hover:underline">
            Terms
          </Link>{' '}
          ·{' '}
          <Link href="/legal/privacy" className="underline-offset-2 hover:text-white/80 hover:underline">
            Privacy
          </Link>
        </p>
        <XqTagline className="text-[15px] font-medium text-white/55 min-[700px]:text-right" />
      </footer>
    </main>
  );
}
