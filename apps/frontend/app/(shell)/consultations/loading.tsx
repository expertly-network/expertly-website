import { PageContainer } from '@/components/layout/PageContainer';

// Dark hero band, then a stack of consultation request cards.
export default function ConsultationsLoading() {
  return (
    <div role="status" aria-label="Loading consultations" className="animate-pulse">
      <section className="bg-ink py-16">
        <PageContainer>
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="mt-3 h-10 w-64 max-w-full rounded-md bg-white/10" />
          <div className="mt-4 h-4 w-1/2 rounded bg-white/10" />
        </PageContainer>
      </section>
      <PageContainer className="flex flex-col gap-4 py-10">
        <div className="h-10 w-72 max-w-full rounded-input bg-bg-alt" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 rounded-card border border-line bg-bg-alt" />
        ))}
      </PageContainer>
      <span className="sr-only">Loading consultations…</span>
    </div>
  );
}
