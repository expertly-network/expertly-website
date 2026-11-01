import { PageContainer } from '@/components/layout/PageContainer';

// Dark hero band, then the event cards grid.
export default function EventsLoading() {
  return (
    <div role="status" aria-label="Loading events" className="animate-pulse">
      <section className="bg-ink py-12 sm:py-16">
        <PageContainer>
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="mt-4 h-10 w-2/3 rounded-md bg-white/10" />
          <div className="mt-4 h-4 w-1/2 rounded bg-white/10" />
        </PageContainer>
      </section>
      <PageContainer className="py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 rounded-card border border-line bg-bg-alt" />
          ))}
        </div>
      </PageContainer>
      <span className="sr-only">Loading events…</span>
    </div>
  );
}
