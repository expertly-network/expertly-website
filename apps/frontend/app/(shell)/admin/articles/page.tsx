import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminArticlesServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { AdminArticlesTable } from '@/components/admin/AdminArticlesTable';

export const metadata = {
  title: 'Articles — Admin — GrowXQ',
};

// UX-only gate; the backend re-checks permissions fresh on every request.
export default async function AdminArticlesPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/articles');
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  const articles = await getAdminArticlesServer();

  return (
    <div>
      <PageHero
        eyebrow="Admin"
        title="Article review queue"
        lede="Review articles submitted for editorial review. Approving one publishes it immediately; rejecting one requires a reason, visible to the author."
      />
      <section className="py-12">
        <PageContainer>
          {articles.length > 0 ? (
            <AdminArticlesTable initialArticles={articles} />
          ) : (
            <p className="py-16 text-center text-sm text-ink-3">No articles waiting for review.</p>
          )}
        </PageContainer>
      </section>
    </div>
  );
}
