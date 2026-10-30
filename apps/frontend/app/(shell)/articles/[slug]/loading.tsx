import { PageContainer } from '@/components/layout/PageContainer';

// Same frame as the article page — cover band, body card, 312px sidebar from lg — so nothing jumps.
export default function ArticleLoading() {
  return (
    <div role="status" aria-label="Loading article" className="animate-pulse">
      <div className="h-[320px] w-full bg-bg-alt max-[640px]:h-[220px]" />
      <PageContainer className="grid items-start gap-10 py-10 lg:grid-cols-[1fr_312px]">
        <div className="rounded-3xl border border-line bg-bg-card px-6 pb-10 pt-8 min-[640px]:px-12 min-[640px]:pt-10">
          <div className="h-9 w-4/5 rounded-md bg-bg-alt" />
          <div className="mt-3 h-9 w-1/2 rounded-md bg-bg-alt" />
          <div className="mt-6 h-4 w-2/3 rounded bg-bg-alt" />
          <div className="mt-10 flex flex-col gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`h-4 rounded bg-bg-alt ${i % 3 === 2 ? 'w-3/4' : 'w-full'}`} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="h-40 rounded-card bg-bg-alt" />
          <div className="h-64 rounded-card bg-bg-alt" />
        </div>
      </PageContainer>
      <span className="sr-only">Loading article…</span>
    </div>
  );
}
