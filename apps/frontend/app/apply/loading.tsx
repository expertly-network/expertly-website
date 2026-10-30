import { Logo } from '@/components/Logo';

// Skeleton for /apply while the server page loads the draft + categories — same two-column frame as
// ApplicationWizard (sidebar + step card), stacking below 900px, so nothing shifts on swap-in.
export default function ApplyLoading() {
  return (
    <main className="relative min-h-screen" aria-busy="true">
      <Logo variant="auth" className="absolute left-8 top-8 z-10" />
      <div className="grid min-h-screen grid-cols-[360px_1fr] bg-bg-alt max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-4 border-r border-line-2 bg-bg-card px-10 pb-14 pt-24 max-[900px]:border-b max-[900px]:border-r-0 max-[900px]:px-6 max-[900px]:pb-10">
          <div className="h-3 w-40 animate-pulse rounded bg-bg-alt" />
          <div className="h-9 w-4/5 animate-pulse rounded-md bg-bg-alt" />
          <div className="h-4 w-full animate-pulse rounded-md bg-bg-alt" />
          <div className="mt-6 flex flex-col gap-3 max-[900px]:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-input bg-bg-alt" />
            ))}
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1300px] px-[60px] pb-14 pt-24 max-[900px]:px-6 max-[900px]:pb-10">
          <div className="mb-10 h-[3px] w-full animate-pulse rounded-full bg-line" />
          <div className="rounded-2xl border border-line-2 bg-bg-card p-12 shadow-[0_8px_36px_rgba(11,11,12,0.02)] max-[640px]:p-6">
            <div className="flex flex-col gap-5">
              <div className="h-7 w-2/5 animate-pulse rounded-md bg-bg-alt" />
              <div className="h-4 w-4/5 animate-pulse rounded-md bg-bg-alt" />
              <div className="mt-4 h-32 animate-pulse rounded-2xl bg-bg-alt" />
              <div className="h-14 animate-pulse rounded-input bg-bg-alt" />
              <div className="h-14 animate-pulse rounded-input bg-bg-alt" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
