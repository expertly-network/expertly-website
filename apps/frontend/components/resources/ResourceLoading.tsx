import { PageContainer } from '@/components/layout/PageContainer';
export function ResourceLoading() {
  return (
    <div role="status" aria-label="Loading resources" className="animate-pulse">
      <div className="h-72 bg-ink" />
      <PageContainer className="py-10">
        <div className="mb-6 h-14 rounded-input bg-bg-alt" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-72 rounded-card bg-bg-alt" />
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
