import { ArticlesHeroSearch } from '@/components/articles/ArticlesHeroSearch';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import type { ArticleListItemDto } from '@shared/article';
import type { MemberListItemDto } from '@shared/member';

// The dark hero band + search, matching design/static_html/articles.html — persistent chrome at
// the top of the whole articles experience (browse, my articles, AND the write flow all sit
// below it on the same page in the prototype). Shared by /articles and /articles/write so the
// write flow doesn't lose this header when it's a separate Next.js route.
export function ArticlesHero({
  members,
  articles,
}: {
  members: MemberListItemDto[];
  articles: ArticleListItemDto[];
}) {
  return (
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
  );
}
