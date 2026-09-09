import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getArticleServer, getArticlesServer, getMembersServer, getPracticeAreasServer } from '@/lib/api/server';
import { buildMembersQueryString } from '@/lib/api/members';
import { ArticlesHero } from '@/components/articles/ArticlesHero';
import { ArticlesTabsNav } from '@/components/articles/ArticlesTabsNav';
import { PageContainer } from '@/components/layout/PageContainer';
import { WriteArticleFlow } from '@/components/articles/WriteArticleFlow';

export const metadata = {
  title: 'Write an Article — Expertly',
};

// Backend enforces the same rule (@Roles('member') on POST /v1/articles) — this redirect is
// UX only, not the authorization boundary. `client` hasn't been vetted into membership yet;
// `member`/`admin` both pass (RolesGuard's ranked model — see articles.controller.ts).
//
// Renders the same hero + tab-row header as /articles (via ArticlesHero/ArticlesTabsNav) — in
// design/static_html/articles.html this is one page with a panel swap, so that header never
// disappears when writing; a separate Next.js route needs to render it again explicitly instead
// of getting it "for free" from a shared layout, since /articles's tabs are page-local state,
// not something a Next.js layout can carry across routes.
//
// `?edit=<id>` — the owner/admin edit entry point (from the article detail page's "Edit" button
// and the My Articles cards' pencil icon). Reuses this same route/flow rather than a separate
// page: WriteArticleFlow just skips straight to the manual form, pre-filled, when `editArticle`
// is passed. No prototype mockup exists for editing an existing article — only the write flow's
// own pre-submit "Edit content" step, which this reuses as-is.
export default async function WriteArticlePage({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/articles/write${searchParams.edit ? `?edit=${searchParams.edit}` : ''}`);
  }
  if (profile.role === 'client') {
    redirect('/articles');
  }

  const [practiceAreas, articles, members, editArticle] = await Promise.all([
    getPracticeAreasServer(),
    getArticlesServer(),
    getMembersServer(
      buildMembersQueryString({ sort: 'featured', practiceAreaId: [], country: [], page: 1, pageSize: 50 })
    ),
    searchParams.edit ? getArticleServer(searchParams.edit) : Promise.resolve(null),
  ]);

  // Same owner-or-admin rule PATCH /v1/articles/:id enforces server-side — this check is UX
  // only, mirroring the `client`-role redirect above.
  if (searchParams.edit) {
    if (!editArticle) notFound();
    if (editArticle.authorId !== profile.id && profile.role !== 'admin') redirect('/articles');
  }

  return (
    <div>
      <ArticlesHero members={members} articles={articles} />

      <section className="py-12">
        <PageContainer>
          <ArticlesTabsNav canWrite active={null} />

          <div className="pt-8">
            <Link
              href={editArticle ? `/articles/${editArticle.id}` : '/articles'}
              className="text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
            >
              ← Back to {editArticle ? 'article' : 'articles'}
            </Link>
          </div>
          <WriteArticleFlow
            practiceAreas={practiceAreas}
            authorName={`${profile.first_name} ${profile.last_name}`.trim()}
            editArticle={editArticle}
          />
        </PageContainer>
      </section>
    </div>
  );
}
