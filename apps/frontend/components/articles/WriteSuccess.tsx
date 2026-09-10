import { Button } from '@/components/ui';
import { WriteCard } from '@/components/articles/WriteCard';
import type { ArticleStatus } from '@shared/article';

const CHECK_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

// Copy adapts to whether the article was published or sent for review.
export function WriteSuccess({ status, articleId }: { status: ArticleStatus; articleId: string }) {
  const isPublished = status === 'published';

  return (
    <WriteCard className="mx-auto max-w-lg">
      <div className="flex animate-[anvIn_0.4s_cubic-bezier(0.22,1,0.36,1)_both] items-center gap-5 p-2">
        <div className="relative flex h-14 w-14 flex-none items-center justify-center rounded-full bg-accent text-bg-card">
          <span className="absolute -inset-1.5 animate-[anvSuccessPulse_1.6s_ease-out_0.3s_2] rounded-full border-2 border-accent opacity-0" />
          {CHECK_ICON}
        </div>
        <div>
          <div className="mb-1 text-[19px] font-semibold tracking-[-0.015em] text-ink">
            {isPublished ? "You're all set." : "You're all set — for now."}
          </div>
          <p className="text-[13.5px] leading-[1.5] text-ink-3">
            {isPublished
              ? 'Your article is live now. Share it with your network, or find it any time under My Articles.'
              : "Submitted for editorial review — you'll find it under My Articles once a decision is made."}
          </p>
        </div>
      </div>
      <div className="flex gap-3 border-t border-line pt-5">
        {isPublished && <Button href={`/articles/${articleId}`}>View article</Button>}
        <Button href="/articles" variant={isPublished ? 'secondary' : 'primary'}>
          Back to articles
        </Button>
      </div>
    </WriteCard>
  );
}
