import { getArticlesServer, getMembersServer, getPracticeAreasServer } from '@/lib/api/server';
import { buildMembersQueryString } from '@/lib/api/members';
import { ArticlesGrid } from '@/components/articles/ArticlesGrid';
import { ArticlesHeroSearch } from '@/components/articles/ArticlesHeroSearch';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';

export const metadata = {
  title: 'Articles — Expertly',
  description:
    'Peer-reviewed analysis and expert commentary from verified finance & legal professionals.',
};

export default async function ArticlesPage() {
  const [articles, practiceAreas, members] = await Promise.all([
    getArticlesServer(),
    getPracticeAreasServer(),
    getMembersServer(
      buildMembersQueryString({ sort: 'featured', practiceAreaId: [], country: [], page: 1, pageSize: 50 })
    ),
  ]);

  return (
    <div>
      {/* Dark hero band, matching design/static_html/articles.html — same treatment as the
          members directory hero. */}
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Knowledge base</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">
            Insights from the people who actually <span className="text-accent">practice.</span>
          </h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Peer-reviewed analysis and expert commentary from verified finance &amp; legal
            professionals.
          </p>
          <ArticlesHeroSearch members={members} articles={articles} />
        </PageContainer>
      </section>

      <section className="py-12">
        <PageContainer>
          {articles.length > 0 ? (
            <ArticlesGrid articles={articles} practiceAreas={practiceAreas} />
          ) : (
            <p className="py-16 text-center text-sm text-ink-3">
              No articles published yet — check back soon.
            </p>
          )}
        </PageContainer>
      </section>
    </div>
  );
}
