import { PageContainer } from '@/components/layout/PageContainer';

export default function Loading() {
  return (
    <PageContainer className="py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[720px] animate-pulse space-y-4">
        <div className="h-8 w-2/3 rounded bg-bg-alt" />
        <div className="h-4 w-full rounded bg-bg-alt" />
        <div className="h-4 w-5/6 rounded bg-bg-alt" />
        <div className="h-48 w-full rounded-xl bg-bg-alt" />
      </div>
    </PageContainer>
  );
}
