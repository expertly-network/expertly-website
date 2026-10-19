import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getArticleServer, getCategoriesServer } from '@/lib/api/server';
import { ArticlesHero } from '@/components/articles/ArticlesHero';
import { ArticlesTabsNav } from '@/components/articles/ArticlesTabsNav';
import { PageContainer } from '@/components/layout/PageContainer';
import { WriteArticleFlow } from '@/components/articles/WriteArticleFlow';

export const metadata = {
  title: 'Write an Article — Expertly',
};

// Redirects clients (not yet vetted) away. `?edit=<id>` is the owner/admin edit entry point,
// reusing this same flow rather than a separate page.
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

  const [categories, editArticle] = await Promise.all([
    getCategoriesServer(),
    searchParams.edit ? getArticleServer(searchParams.edit) : Promise.resolve(null),
  ]);

  if (searchParams.edit) {
    if (!editArticle) notFound();
    if (editArticle.authorId !== profile.id && profile.role !== 'admin') redirect('/articles');
  }

  return (
    <div>
      <ArticlesHero />

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
            categories={categories}
            authorName={`${profile.first_name} ${profile.last_name}`.trim()}
            editArticle={editArticle}
          />
        </PageContainer>
      </section>
    </div>
  );
}
