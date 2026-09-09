import {
  getArticlesServer,
  getMembersServer,
  getMyArticlesServer,
  getPracticeAreasServer,
} from '@/lib/api/server';
import { buildMembersQueryString } from '@/lib/api/members';
import { getSessionUser } from '@/lib/auth/session-claims';
import { ArticlesHero } from '@/components/articles/ArticlesHero';
import { ArticlesTabsSection } from '@/components/articles/ArticlesTabsSection';
import { PageContainer } from '@/components/layout/PageContainer';

export const metadata = {
  title: 'Articles — Expertly',
  description:
    'Peer-reviewed analysis and expert commentary from verified finance & legal professionals.',
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const [articles, practiceAreas, members, profile] = await Promise.all([
    getArticlesServer(),
    getPracticeAreasServer(),
    getMembersServer(
      buildMembersQueryString({ sort: 'featured', practiceAreaId: [], country: [], page: 1, pageSize: 50 })
    ),
    getSessionUser(),
  ]);
  // Only a vetted member (or admin) can author an article — matches
  // @Roles('member') on POST /v1/articles; a signed-out visitor or a `client`
  // who hasn't been approved yet never sees the entry point (or the My Articles tab).
  const canWrite = profile?.role === 'member' || profile?.role === 'admin';
  const myArticles = canWrite ? await getMyArticlesServer() : [];

  return (
    <div>
      <ArticlesHero members={members} articles={articles} />

      <section className="py-12">
        <PageContainer>
          <ArticlesTabsSection
            articles={articles}
            practiceAreas={practiceAreas}
            myArticles={myArticles}
            canWrite={canWrite}
            initialTab={searchParams.tab === 'mine' ? 'mine' : 'browse'}
          />
        </PageContainer>
      </section>
    </div>
  );
}
