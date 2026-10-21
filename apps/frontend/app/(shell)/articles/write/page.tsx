import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getArticleServer, getCategoriesServer } from '@/lib/api/server';
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
    // No marketing hero here — it pushed the form below the fold. The flow owns the single
    // "← Back" control (it knows whether that means a previous step or leaving the editor).
    <div>
      <section className="pb-12 pt-8">
        <PageContainer>
          <ArticlesTabsNav canWrite active={null} />
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
