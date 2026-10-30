import { PageContainer } from '@/components/layout/PageContainer';

// Profile frame: header card (cover + photo + name), then the tab panel beside a sidebar from lg.
export default function MemberProfileLoading() {
  return (
    <div role="status" aria-label="Loading profile">
      <PageContainer className="animate-pulse pb-20 pt-10 max-[720px]:pt-5">
        <div className="overflow-hidden rounded-card border border-line bg-bg-card">
          <div className="h-32 bg-bg-alt" />
          <div className="px-6 pb-6">
            <div className="-mt-16 h-36 w-36 rounded-2xl border-4 border-bg-card bg-bg-alt" />
            <div className="mt-5 h-7 w-64 max-w-full rounded-md bg-bg-alt" />
            <div className="mt-3 h-4 w-96 max-w-full rounded bg-bg-alt" />
          </div>
        </div>
        <div className="mt-5 flex items-start gap-6 max-[1023px]:flex-col">
          <div className="h-96 w-full flex-1 rounded-card bg-bg-alt" />
          <div className="h-72 w-[320px] flex-none rounded-card bg-bg-alt max-[1023px]:w-full" />
        </div>
        <span className="sr-only">Loading profile…</span>
      </PageContainer>
    </div>
  );
}
