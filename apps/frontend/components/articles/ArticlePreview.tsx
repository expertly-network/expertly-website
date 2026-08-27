import { Badge, Button, Card } from '@/components/ui';
import type { ArticleListItemDto } from '@shared/article';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

// Guest view of an article detail page — per docs/user-stories.md US-01-03, a signed-out
// visitor sees the list-shape data (title + excerpt) but not the full body, which genuinely
// requires auth at the API level (GET /v1/articles/:id has no @Public()). This calls only the
// public GET /v1/articles list endpoint and finds the matching item — it never calls the
// gated detail endpoint for a guest, since that would just 401.
export function ArticlePreview({ article }: { article: ArticleListItemDto }) {
  return (
    <div>
      <div className="relative h-[320px] w-full overflow-hidden max-[640px]:h-[220px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={article.coverImageUrl} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[1150px] items-center gap-3 px-8 pb-6 max-[640px]:px-5">
          <a href="/articles" className="text-sm font-medium text-white/80 hover:text-white">
            ← Articles
          </a>
          {article.practiceAreas[0] && (
            <Badge variant="emphasis">{article.practiceAreas[0].name}</Badge>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[750px] px-8 py-10 max-[640px]:px-5">
        <Card padding="lg">
          <h1 className="text-headline text-ink">{article.title}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-line pb-5 text-sm text-ink-3">
            <span>{DATE_FORMAT.format(new Date(article.createdAt)).toUpperCase()}</span>
            <span className="text-ink-4">·</span>
            <span>{article.readTimeMinutes} min read</span>
            <span className="text-ink-4">·</span>
            <span>{article.authorName}</span>
            <span className="text-ink-4">·</span>
            <span>{article.country}</span>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-ink-2">{article.excerpt}</p>

          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-line bg-bg-alt px-6 py-8 text-center">
            <p className="text-sm font-medium text-ink">Sign in to read the full article</p>
            <p className="max-w-sm text-sm text-ink-3">
              The rest of this article, plus member profiles and consultation requests, are
              available to signed-in users.
            </p>
            <div className="mt-1 flex gap-3">
              <Button href="/login">Sign In</Button>
              <Button href="/apply" variant="secondary">
                Apply for membership
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
