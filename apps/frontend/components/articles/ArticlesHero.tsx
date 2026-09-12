import { ArticlesHeroSearch } from '@/components/articles/ArticlesHeroSearch';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import type { ArticleListItemDto } from '@shared/article';
import type { MemberListItemDto } from '@shared/member';

// Shared by /articles and /articles/write so the write flow keeps this header.
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
