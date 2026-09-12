'use client';

import { useState } from 'react';
import { ArticlesGrid } from '@/components/articles/ArticlesGrid';
import { MyArticlesPanel } from '@/components/articles/MyArticlesPanel';
import { ArticlesTabsNav, type ArticlesTab } from '@/components/articles/ArticlesTabsNav';
import type { ArticleListItemDto } from '@shared/article';
import type { PracticeAreaDto } from '@shared/practice-area';

export function ArticlesTabsSection({
  articles,
  practiceAreas,
  myArticles,
  canWrite,
  initialTab = 'browse',
}: {
  articles: ArticleListItemDto[];
  practiceAreas: PracticeAreaDto[];
  myArticles: ArticleListItemDto[];
  canWrite: boolean;
  /** Set from ?tab=mine so a link straight to "My Articles" (e.g. from /articles/write's nav)
   * lands on the right panel instead of always defaulting to Browse. */
  initialTab?: ArticlesTab;
}) {
  const [tab, setTab] = useState<ArticlesTab>(initialTab);

  return (
    <div>
      <ArticlesTabsNav canWrite={canWrite} active={tab} onTabChange={setTab} />

      <div className="mt-8">
        {tab === 'browse' ? (
          articles.length > 0 ? (
            <ArticlesGrid articles={articles} practiceAreas={practiceAreas} />
          ) : (
            <p className="py-16 text-center text-sm text-ink-3">
              No articles published yet — check back soon.
            </p>
          )
        ) : (
          <MyArticlesPanel articles={myArticles} />
        )}
      </div>
    </div>
  );
}
