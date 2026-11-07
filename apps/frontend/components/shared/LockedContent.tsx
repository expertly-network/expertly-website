import type { ReactNode } from 'react';
import Link from 'next/link';
import { SignInButton } from '@/components/auth/SignInLink';

// Signed-out visitors can browse articles and members, but the detail behind them is gated.
// TeaserFade shows a little real, public content (an excerpt, a bio) fading out; SignInGate is the
// branded panel underneath it. Protected content is never sent to a signed-out browser — whatever
// is passed to TeaserFade must already be public.

export function TeaserFade({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`pointer-events-none relative max-h-40 select-none overflow-hidden [mask-image:linear-gradient(to_bottom,black_30%,transparent)] ${className}`}
      aria-hidden="true"
    >
      {children}
      {/* Blur creeps in toward the bottom, so the text reads as sealed rather than just faded. */}
      <div className="absolute inset-x-0 bottom-0 h-3/4 backdrop-blur-[3px] [mask-image:linear-gradient(to_bottom,transparent,black_70%)]" />
    </div>
  );
}

export function SignInGate({
  eyebrow,
  title,
  description,
  perks,
  buttonLabel = 'Sign in to continue',
  className = '',
}: {
  eyebrow: string;
  title: string;
  description: string;
  perks: string[];
  buttonLabel?: string;
  className?: string;
}) {
  return (
    // Outer wrapper leaves room for the padlock seal, which sits on the panel's top edge (the panel
    // itself clips its glow, so the seal can't live inside it).
    <section className={`group/gate relative pt-6 ${className}`} aria-label={title}>
      <LockSeal />

      <div className="relative isolate overflow-hidden rounded-card bg-ink px-5 pb-6 pt-11 text-center text-white sm:px-8">
        <GateGlow />

        <p className="text-label text-accent">{eyebrow}</p>
        <h2 className="mx-auto mt-2 max-w-md text-title text-white sm:text-stat">{title}</h2>
        <p className="mx-auto mt-2 max-w-lg text-caption leading-relaxed text-white/60">{description}</p>

        <ul className="mt-5 flex flex-wrap justify-center gap-2">
          {perks.map((perk) => (
            <li
              key={perk}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-caption text-white/75"
            >
              <LockIcon size={12} />
              {perk}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col items-center gap-3">
          <SignInButton variant="accent" size="sm" className="w-full sm:w-auto">
            {buttonLabel}
            <ArrowIcon />
          </SignInButton>
          <p className="text-caption text-white/50">
            Are you an expert?{' '}
            <Link
              href="/apply"
              className="font-medium text-white/85 underline-offset-4 hover:text-white hover:underline"
            >
              Apply for membership
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

// Solid green padlock on the panel's top edge. Its shackle lifts open while the visitor hovers or
// focuses anything in the gate — a small "this unlocks" cue.
function LockSeal() {
  return (
    <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
      <span
        aria-hidden="true"
        className="absolute inset-0 animate-ping rounded-full bg-accent/30 [animation-duration:2.4s] motion-reduce:hidden"
      />
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_-6px_color-mix(in_oklab,var(--accent)_70%,transparent)] ring-4 ring-bg-card">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path
            d="M8 11V7.5a4 4 0 0 1 8 0V11"
            className="origin-[16px_11px] transition-transform duration-300 ease-out group-focus-within/gate:-translate-y-[2px] group-focus-within/gate:-rotate-[18deg] group-hover/gate:-translate-y-[2px] group-hover/gate:-rotate-[18deg] motion-reduce:transition-none"
          />
          <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" />
          <circle cx="12" cy="16" r="1.4" className="fill-accent stroke-none" />
        </svg>
      </span>
    </div>
  );
}

function GateGlow() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 -z-10 h-[340px] w-[340px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--accent) 28%, transparent) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-20 -z-10 h-[300px] w-[300px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--accent) 12%, transparent) 0%, transparent 70%)',
        }}
      />
      {/* Faint grid, masked to the top-right where the glow sits. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_65%)]"
      />
    </>
  );
}

export function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="relative flex-none"
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}
