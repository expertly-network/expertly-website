import { notFound } from 'next/navigation';
import { isSiteLaunched } from '@/lib/env';

// The public home while SITE_LAUNCHED=false: middleware.ts serves this at `/` (invitees are sent
// /invitation instead). Once launched it doesn't exist.

export const metadata = {
  title: 'GrowXQ — Coming soon',
  description: 'GrowXQ. Coming soon.',
  openGraph: { url: '/' },
};

// hs-fade-up / hs-fade-in are the shared hero keyframes in globals.css. The heading waits for the
// logo animation to settle (~1.6s) before it rises in.
const RISE = 'motion-safe:[animation:hs-fade-up_1s_cubic-bezier(0.22,1,0.36,1)_1.6s_both]';
const FADE = 'motion-safe:[animation:hs-fade-in_1.2s_ease-out_1.2s_both]';

export default function ComingSoonPage() {
  if (isSiteLaunched()) notFound();

  return (
    <main className="relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-black px-4 py-16 text-white">
      {/* A low brand-green glow under the logo; the hairline below echoes it. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_40%_at_50%_55%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_72%)] ${FADE}`}
      />

      <div className="flex w-full max-w-[680px] flex-col items-center text-center">
        {/* The animated logo, cropped to the band it lives in (and wider than a phone screen, so
            the logo itself stays large — the sides are empty black). mix-blend-screen drops the
            video's black so the glow shows through; muted + playsInline lets mobile autoplay. */}
        <video
          className="aspect-[1344/300] w-[min(760px,140vw)] max-w-none object-cover mix-blend-screen"
          src="/brand/growxq-intro.mp4"
          poster="/brand/growxq-intro-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="GrowXQ"
        />

        <span
          aria-hidden="true"
          className={`mt-[clamp(28px,5vw,48px)] h-px w-16 bg-gradient-to-r from-transparent via-accent to-transparent ${FADE}`}
        />

        <h1
          className={`m-0 mt-[clamp(24px,4vw,40px)] bg-gradient-to-b from-white to-white/60 bg-clip-text font-brand text-[clamp(40px,7vw,72px)] font-normal leading-[1.05] tracking-[-0.02em] text-transparent pb-[0.18em] ${RISE}`}
        >
          Coming soon
        </h1>
      </div>
    </main>
  );
}
