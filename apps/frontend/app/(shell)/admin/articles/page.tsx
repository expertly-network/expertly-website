import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminArticlesServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { AdminArticlesTable } from '@/components/admin/AdminArticlesTable';

export const metadata = {
  title: 'Articles — Admin — Expertly',
};

// UX-only gate; the backend re-checks permissions fresh on every request.
export default async function AdminArticlesPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/articles');
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const articles = await getAdminArticlesServer();

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Article review queue</h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Review articles submitted for editorial review. Approving one publishes it
            immediately; rejecting one requires a reason, visible to the author.
          </p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          {articles.length > 0 ? (
            <AdminArticlesTable initialArticles={articles} />
          ) : (
            <p className="py-16 text-center text-sm text-ink-3">
              No articles waiting for review.
            </p>
          )}
        </PageContainer>
      </section>
    </div>
  );
}
