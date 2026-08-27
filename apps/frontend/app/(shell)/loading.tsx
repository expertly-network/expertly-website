import { PageContainer } from '@/components/layout/PageContainer';

// Generic skeleton fallback for the (shell) route group while a Server Component page fetches
// data — e.g. the homepage's members/practice-areas/articles fetch. Deliberately simple/generic
// (not homepage-specific) since this is the fallback for any nested (shell) route without its
// own loading.tsx. Uses the same PageContainer width as the real pages so there's no layout
// shift when the skeleton is replaced by real content.
export default function ShellLoading() {
  return (
    <PageContainer className="animate-pulse py-10">
      <div className="h-3 w-32 rounded bg-bg-alt" />
      <div className="mt-3 h-8 w-2/3 rounded bg-bg-alt" />
      <div className="mt-3 h-8 w-1/2 rounded bg-bg-alt" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-card border border-line bg-bg-alt" />
        ))}
      </div>
    </PageContainer>
  );
}
