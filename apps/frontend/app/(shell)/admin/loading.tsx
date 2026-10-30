import { PageContainer } from '@/components/layout/PageContainer';

// One skeleton for every admin screen: title, filter row, and a table. Rows are a single block
// below sm (the admin tables scroll horizontally there), full columns from sm up.
export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading">
      <PageContainer className="animate-pulse py-10">
        <div className="h-3 w-20 rounded bg-bg-alt" />
        <div className="mt-3 h-8 w-72 max-w-full rounded-md bg-bg-alt" />
        <div className="mt-8 flex flex-wrap gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-24 rounded-full bg-bg-alt" />
          ))}
        </div>
        <div className="mt-6 overflow-hidden rounded-card border border-line bg-bg-card">
          <div className="hidden grid-cols-[2fr_1fr_1fr_120px] gap-4 border-b border-line px-5 py-3.5 sm:grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-3 w-20 rounded bg-bg-alt" />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-4 border-b border-line px-5 py-4 last:border-none sm:grid-cols-[2fr_1fr_1fr_120px]"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 flex-none rounded-full bg-bg-alt" />
                <div className="h-4 w-full max-w-[220px] rounded bg-bg-alt" />
              </div>
              <div className="hidden h-4 rounded bg-bg-alt sm:block" />
              <div className="hidden h-4 rounded bg-bg-alt sm:block" />
              <div className="hidden h-7 rounded-full bg-bg-alt sm:block" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading…</span>
      </PageContainer>
    </div>
  );
}
