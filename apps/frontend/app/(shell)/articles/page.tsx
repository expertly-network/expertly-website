import { getArticlesServer, getMyArticlesServer, getCategoriesServer } from '@/lib/api/server';
import { ARTICLES_PAGE_SIZE } from '@/lib/api/articles-query';
import { getSessionUser } from '@/lib/auth/session-claims';
import { ArticlesHero } from '@/components/articles/ArticlesHero';
import { ArticlesTabsSection } from '@/components/articles/ArticlesTabsSection';
import { PageContainer } from '@/components/layout/PageContainer';
import { SuccessNotice } from '@/components/shared/SuccessNotice';

export const metadata = {
  title: 'Articles — GrowXQ',
  description: 'Peer-reviewed analysis and expert commentary from verified finance & legal professionals.',
};

function canWriteArticles(role: string | undefined): boolean {
  return role === 'member' || role === 'admin';
}

export default async function ArticlesPage(props: {
  searchParams: Promise<{ tab?: string; saved?: string; service?: string }>;
}) {
  const searchParams = await props.searchParams;
  // Only a vetted member (or admin) can author an article — matches
  // @Roles('member') on POST /v1/articles; a signed-out visitor or a `client`
  // who hasn't been approved yet never sees the entry point (or the My Articles tab).
  // "My articles" is chained off the session, so all four requests run concurrently.
  const profilePromise = getSessionUser();
  // ?service=<id> (from a service label on an article) pre-filters the grid. The id is checked
  // against the real services list before it's used.
  const categories = await getCategoriesServer();
  const requestedService = searchParams.service;
  const initialServiceFilter =
    requestedService && categories.some((c) => c.services.some((s) => s.id === requestedService))
      ? [requestedService]
      : [];
  const [firstPage, profile, myArticles] = await Promise.all([
    getArticlesServer({ page: 1, pageSize: ARTICLES_PAGE_SIZE, serviceId: initialServiceFilter }),
    profilePromise,
    profilePromise.then((p) => (canWriteArticles(p?.role) ? getMyArticlesServer() : [])),
  ]);
  const canWrite = canWriteArticles(profile?.role);

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
            articles={firstPage.items}
            totalArticles={firstPage.total}
            categories={categories}
            myArticles={myArticles}
            canWrite={canWrite}
            initialTab={searchParams.tab === 'mine' ? 'mine' : 'browse'}
            initialServiceFilter={initialServiceFilter}
          />
        </PageContainer>
      </section>
    </div>
  );
}
