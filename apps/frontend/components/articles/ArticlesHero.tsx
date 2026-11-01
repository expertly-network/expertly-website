import { ArticlesHeroSearch } from '@/components/articles/ArticlesHeroSearch';
import { PageHero } from '@/components/layout/PageHero';

// Shared by /articles and /articles/write so the write flow keeps this header.
export function ArticlesHero() {
  return (
    <PageHero
      eyebrow="Knowledge base"
      title={
        <>
          Insights from the people who actually <span className="text-accent">practice.</span>
        </>
      }
      lede="Peer-reviewed analysis and expert commentary from verified finance & legal professionals."
      search={<ArticlesHeroSearch />}
    />
  );
}
