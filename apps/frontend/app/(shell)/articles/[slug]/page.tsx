import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getArticlePreviewServer, getArticleServer, getArticlesServer, getMemberServer } from '@/lib/api/server';
import { ArticlePreview } from '@/components/articles/ArticlePreview';
import { ArticleAuthorSidebar } from '@/components/articles/ArticleAuthorSidebar';
import { ArticleShareBar } from '@/components/articles/ArticleShareBar';
import { RelatedArticles } from '@/components/articles/RelatedArticles';
import { ArticleNewsletterCard } from '@/components/articles/ArticleNewsletterCard';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge, Button } from '@/components/ui';
import type { ArticleDto, ArticleListItemDto } from '@shared/article';
import { mustHotlink } from '@/lib/images';
import { ARTICLE_PROSE } from '@/lib/articles/prose';
import { formatDate } from '@/lib/dates';

// Only the author/admin can open a non-published article (the API 404s everyone else), so this
// banner is what tells them it isn't public — and why there's nothing to share yet.
const STATUS_NOTICE: Record<Exclude<ArticleDto['status'], 'published'>, { label: string; body: string }> = {
  draft: { label: 'Draft', body: 'Only you can see this article. Publish it to make it public.' },
  pending_review: { label: 'Pending review', body: 'The GrowXQ team is reviewing this article — it isn’t public yet.' },
  rejected: { label: 'Not approved', body: 'This article wasn’t approved. Edit and resubmit it to publish.' },
};

const LEGAL_DISCLAIMER =
  'The views expressed in this article are those of the author and do not constitute legal, tax, or financial advice. This content is published for informational purposes only. Readers should seek independent professional advice before acting on any information contained herein.';

const META_ICON_PROPS = {
  width: 12,
  height: 12,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'flex-none text-ink-4',
};

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
    return <ArticlePreview article={preview} />;
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

  const summaryPoints = article.aiSummary?.split('\n').filter(Boolean) ?? [];

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
        <PageContainer className="absolute inset-x-0 bottom-0 flex items-center gap-3 pb-6">
          <Link href="/articles" className="text-sm font-medium text-white/80 hover:text-white">
            ← Articles
          </Link>
          {article.services[0] && <Badge variant="emphasis">{article.services[0].name}</Badge>}
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

            <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                <span className="flex items-center gap-1.5 text-caption text-ink-3">
                  <svg {...META_ICON_PROPS}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {formatDate(new Date(article.createdAt))}
                </span>
                <span className="flex items-center gap-1.5 text-caption text-ink-3">
                  <svg {...META_ICON_PROPS}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {article.readTimeMinutes} min read
                </span>
                <span className="flex items-center gap-1.5 text-caption text-ink-3">
                  <svg {...META_ICON_PROPS}>
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {article.authorName}
                </span>
                {article.countries.length > 0 && (
                  <span className="flex items-center gap-1.5 text-caption text-ink-3">
                    <svg {...META_ICON_PROPS}>
                      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {article.countries.join(', ')}
                  </span>
                )}
              </div>
              <div className="flex flex-none items-center gap-3">
                {(article.authorId === sessionUser.id || sessionUser.role === 'admin') && (
                  <Button href={`/articles/write?edit=${article.id}`} variant="secondary" size="sm">
                    Edit
                  </Button>
                )}
                {article.status === 'published' && <ArticleShareBar title={article.title} />}
              </div>
            </div>

            {summaryPoints.length > 0 && (
              <div className="relative mt-7 overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--accent)_22%,transparent)] bg-[color-mix(in_oklab,var(--accent)_6%,var(--bg-alt))] p-5 min-[640px]:p-6">
                <div className="mb-3.5 flex items-center gap-2">
                  <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-accent text-bg-card">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <span className="text-mono-label font-bold text-accent">AI SUMMARY</span>
                  <span className="art-ai-pulse ml-auto h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                </div>
                <ul className="relative flex flex-col gap-2.5">
                  {summaryPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.55] text-ink-2">
                      <span className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--accent)_15%,transparent)] text-[8px] font-bold text-accent">
                        ✦
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
