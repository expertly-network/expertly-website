import { getArticlesServer, getMyArticlesServer, getCategoriesServer } from '@/lib/api/server';
import { getSessionUser } from '@/lib/auth/session-claims';
import { ArticlesHero } from '@/components/articles/ArticlesHero';
import { ArticlesTabsSection } from '@/components/articles/ArticlesTabsSection';
import { PageContainer } from '@/components/layout/PageContainer';
import { SuccessNotice } from '@/components/shared/SuccessNotice';

export const metadata = {
  title: 'Articles — Expertly',
  description:
    'Peer-reviewed analysis and expert commentary from verified finance & legal professionals.',
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: { tab?: string; saved?: string };
}) {
  const [articles, categories, profile] = await Promise.all([
    getArticlesServer(),
    getCategoriesServer(),
    getSessionUser(),
  ]);
  // Only a vetted member (or admin) can author an article — matches
  // @Roles('member') on POST /v1/articles; a signed-out visitor or a `client`
  // who hasn't been approved yet never sees the entry point (or the My Articles tab).
  const canWrite = profile?.role === 'member' || profile?.role === 'admin';
  const myArticles = canWrite ? await getMyArticlesServer() : [];

  return (
    <div>
      <ArticlesHero />

      <section className="py-12">
        <PageContainer>
          {searchParams.saved === 'draft' && (
            <div className="mb-6">
              <SuccessNotice message="Draft saved. It's private to you until you publish it." />
            </div>
          )}
          <ArticlesTabsSection
            articles={articles}
            categories={categories}
            myArticles={myArticles}
            canWrite={canWrite}
            initialTab={searchParams.tab === 'mine' ? 'mine' : 'browse'}
          />
        </PageContainer>
      </section>
    </div>
  );
}
