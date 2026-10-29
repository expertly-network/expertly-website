import { PageContainer } from '@/components/layout/PageContainer';

export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-label="Loading your dashboard"
      className="animate-pulse"
    >
      <div className="h-72 bg-ink" />
      <PageContainer className="py-8">
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-card bg-bg-alt" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-96 rounded-card bg-bg-alt" />
          <div className="h-72 rounded-card bg-bg-alt" />
        </div>
      </PageContainer>
      <span className="sr-only">Loading your dashboard…</span>
    </div>
  );
}
