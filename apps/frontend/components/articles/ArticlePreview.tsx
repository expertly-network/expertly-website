import Image from 'next/image';
import Link from 'next/link';
import { Badge, Button, Card } from '@/components/ui';
import { SignInButton } from '@/components/auth/SignInLink';
import type { ArticleListItemDto } from '@shared/article';
import { mustHotlink } from '@/lib/images';
import { ArticleByline } from '@/components/articles/ArticleByline';
import { ArticleAiSummary } from '@/components/articles/ArticleAiSummary';

// A signed-out visitor sees a teaser (title, AI summary, excerpt), not the full body.
export function ArticlePreview({ article }: { article: ArticleListItemDto }) {
  return (
    <div>
      <div className="relative h-[320px] w-full overflow-hidden max-[640px]:h-[220px]">
        <Image
          src={article.coverImageUrl}
          unoptimized={mustHotlink(article.coverImageUrl)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[1150px] items-center gap-3 px-8 pb-6 max-[640px]:px-5">
          <Link href="/articles" className="text-sm font-medium text-white/80 hover:text-white">
            ← Articles
          </Link>
          {article.services[0] && (
            <Link
              href={`/articles?service=${encodeURIComponent(article.services[0].id)}`}
              title={`More articles on ${article.services[0].name}`}
              className="min-w-0 rounded-full hover:opacity-85"
            >
              <Badge variant="emphasis" className="max-w-full">
                <span className="truncate">{article.services[0].name}</span>
              </Badge>
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[750px] px-8 py-10 max-[640px]:px-5">
        <Card padding="lg">
          <h1 className="font-sans text-article-title text-ink">{article.title}</h1>

          <ArticleByline article={article} showAuthor />

          <ArticleAiSummary summary={article.aiSummary} className="mt-6" />

          <p className="mt-6 text-sm leading-relaxed text-ink-2">{article.excerpt}</p>

          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-line bg-bg-alt px-6 py-8 text-center">
            <p className="text-sm font-medium text-ink">Sign in to read the full article</p>
            <p className="max-w-sm text-sm text-ink-3">
              The rest of this article, plus member profiles and consultation requests, are available to signed-in
              users.
            </p>
            <div className="mt-1 flex gap-3">
              <SignInButton>Sign In</SignInButton>
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
