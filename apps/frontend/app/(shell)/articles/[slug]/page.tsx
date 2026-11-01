import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getArticlePreviewServer, getArticleServer, getArticlesServer, getMemberServer } from '@/lib/api/server';
import { ArticlePreview } from '@/components/articles/ArticlePreview';
import { ArticleAiSummary } from '@/components/articles/ArticleAiSummary';
import { ArticleByline } from '@/components/articles/ArticleByline';
import { ArticleJsonLd } from '@/components/articles/ArticleJsonLd';
import { ArticleAuthorSidebar } from '@/components/articles/ArticleAuthorSidebar';
import { ArticleShareBar } from '@/components/articles/ArticleShareBar';
import { RelatedArticles } from '@/components/articles/RelatedArticles';
import { ArticleNewsletterCard } from '@/components/articles/ArticleNewsletterCard';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge, Button } from '@/components/ui';
import type { ArticleDto, ArticleListItemDto } from '@shared/article';
import { mustHotlink } from '@/lib/images';
import { ARTICLE_PROSE } from '@/lib/articles/prose';

// Only the author/admin can open a non-published article (the API 404s everyone else), so this
// banner is what tells them it isn't public — and why there's nothing to share yet.
const STATUS_NOTICE: Record<Exclude<ArticleDto['status'], 'published'>, { label: string; body: string }> = {
  draft: { label: 'Draft', body: 'Only you can see this article. Publish it to make it public.' },
  pending_review: { label: 'Pending review', body: 'The GrowXQ team is reviewing this article — it isn’t public yet.' },
  rejected: { label: 'Not approved', body: 'This article wasn’t approved. Edit and resubmit it to publish.' },
};

const LEGAL_DISCLAIMER =
  'The views expressed in this article are those of the author and do not constitute legal, tax, or financial advice. This content is published for informational purposes only. Readers should seek independent professional advice before acting on any information contained herein.';

const RELATED_COUNT = 4;

// Same-service articles first, backfilled with the latest others — two small cached queries
// instead of loading every article to pick 4.
async function loadRelated(article: ArticleDto): Promise<ArticleListItemDto[]> {
  const serviceIds = article.services.map((s) => s.id);
  const [sameService, latest] = await Promise.all([
    serviceIds.length > 0
      ? getArticlesServer({ serviceId: serviceIds, excludeId: article.id, pageSize: RELATED_COUNT })
      : Promise.resolve({ items: [], total: 0 }),
    getArticlesServer({ excludeId: article.id, pageSize: RELATED_COUNT }),
  ]);
  const seen = new Set<string>();
  return [...sameService.items, ...latest.items]
    .filter((a) => !seen.has(a.id) && seen.add(a.id))
    .slice(0, RELATED_COUNT);
}

// Only published articles get real Open Graph data; a signed-in reader's draft/pending article
// still gets its own tab title. Runs before the page streams, so an unknown slug is a real 404.
export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const article = await getArticlePreviewServer(params.slug);
  if (!article) {
    const sessionUser = await getSessionUser();
    if (!sessionUser) notFound();
    const own = await getArticleServer(params.slug);
    if (!own) notFound();
    return { title: `${own.title} — GrowXQ`, robots: { index: false } };
  }

  return {
    title: `${article.title} — GrowXQ`,
    description: article.excerpt,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.excerpt,
      url: `/articles/${article.slug}`,
      images: [{ url: article.coverImageUrl }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: [article.coverImageUrl],
    },
  };
}

export default async function ArticleDetailPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const sessionUser = await getSessionUser();

  // A signed-out visitor gets a teaser (title + excerpt), never the full body. The URL key is the
  // slug; a legacy UUID URL (old shared links, admin tables) is permanently redirected to it.
  if (!sessionUser) {
    const preview = await getArticlePreviewServer(params.slug);
    if (!preview) notFound();
    if (preview.slug !== params.slug) permanentRedirect(`/articles/${preview.slug}`);
    return (
      <>
        <ArticleJsonLd article={preview} />
        <ArticlePreview article={preview} />
      </>
    );
  }

  const article = await getArticleServer(params.slug);
  if (!article) {
    notFound();
  }
  if (article.slug !== params.slug) permanentRedirect(`/articles/${article.slug}`);

  const [author, relatedArticles] = await Promise.all([
    // Authors without a member profile (no slug) get no author sidebar.
    article.authorSlug ? getMemberServer(article.authorSlug) : Promise.resolve(null),
    loadRelated(article),
  ]);

  return (
    <div>
      {article.status === 'published' && <ArticleJsonLd article={article} />}
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
        <PageContainer className="absolute inset-x-0 bottom-0 flex items-center gap-3 pb-6">
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
        </PageContainer>
      </div>

      <PageContainer className="grid items-start gap-10 py-10 lg:grid-cols-[1fr_312px]">
        <article className="overflow-hidden rounded-3xl border border-line bg-bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02),0_24px_48px_-30px_rgba(0,0,0,0.22)]">
          <div className="px-6 pb-10 pt-8 min-[640px]:px-12 min-[640px]:pb-14 min-[640px]:pt-10">
            {article.status !== 'published' && (
              <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <Badge variant="warning">{STATUS_NOTICE[article.status].label}</Badge>
                <span className="text-sm text-amber-700">{STATUS_NOTICE[article.status].body}</span>
              </div>
            )}
            <h1 className="font-sans text-article-title text-ink">{article.title}</h1>

            <ArticleByline
              article={article}
              showAuthor={!author}
              actions={
                <>
                  {(article.authorId === sessionUser.id || sessionUser.role === 'admin') && (
                    <Button href={`/articles/write?edit=${article.id}`} variant="secondary" size="sm">
                      Edit
                    </Button>
                  )}
                  {article.status === 'published' && <ArticleShareBar title={article.title} />}
                </>
              }
            />

            <ArticleAiSummary summary={article.aiSummary} className="mt-7" />

            <div
              className={`${ARTICLE_PROSE} mt-8`}
              // Safe — article.body is sanitized server-side before storage.
              dangerouslySetInnerHTML={{ __html: article.body }}
            />

            <p className="mt-9 rounded-[10px] border border-line bg-bg-alt px-[18px] py-3.5 text-mono-label leading-[1.65] text-ink-4">
              {LEGAL_DISCLAIMER}
            </p>
          </div>
        </article>

        <div className="flex flex-col gap-5 lg:sticky lg:top-10 lg:self-start">
          {author && <ArticleAuthorSidebar author={author} />}
          <RelatedArticles current={article} articles={relatedArticles} />
          <ArticleNewsletterCard />
        </div>
      </PageContainer>
    </div>
  );
}
