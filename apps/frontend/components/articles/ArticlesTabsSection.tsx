'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArticlesGrid } from '@/components/articles/ArticlesGrid';
import { MyArticlesPanel } from '@/components/articles/MyArticlesPanel';
import { ArticlesTabsNav, type ArticlesTab } from '@/components/articles/ArticlesTabsNav';
import type { ArticleListItemDto } from '@shared/article';
import type { CategoryDto } from '@shared/category';

export function ArticlesTabsSection({
  articles,
  totalArticles,
  categories,
  myArticles,
  canWrite,
  initialTab = 'browse',
}: {
  /** First page of the browse grid; the grid fetches further pages itself. */
  articles: ArticleListItemDto[];
  totalArticles: number;
  categories: CategoryDto[];
  myArticles: ArticleListItemDto[];
  canWrite: boolean;
  /** Set from ?tab=mine so a link straight to "My Articles" (e.g. from /articles/write's nav)
   * lands on the right panel instead of always defaulting to Browse. */
  initialTab?: ArticlesTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<ArticlesTab>(initialTab);

  // Mirrors the tab into the URL so it survives refresh and can be deep-linked (?tab=mine).
  function changeTab(next: ArticlesTab) {
    setTab(next);
    router.replace(next === 'mine' ? `${pathname}?tab=mine` : pathname, { scroll: false });
  }

  return (
    <div>
      <ArticlesTabsNav canWrite={canWrite} active={tab} onTabChange={changeTab} />

      <div className="mt-8">
        {tab === 'browse' ? (
          articles.length > 0 ? (
            <ArticlesGrid initialArticles={articles} initialTotal={totalArticles} categories={categories} />
          ) : (
            <p className="py-16 text-center text-sm text-ink-3">No articles published yet — check back soon.</p>
          )
        ) : (
          <MyArticlesPanel articles={myArticles} />
        )}
      </div>
    </div>
  );
}
