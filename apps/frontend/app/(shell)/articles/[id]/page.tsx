import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getArticleServer, getArticlesServer, getMemberServer } from '@/lib/api/server';
import { ArticlePreview } from '@/components/articles/ArticlePreview';
import { ArticleAuthorSidebar } from '@/components/articles/ArticleAuthorSidebar';
import { ArticleShareBar } from '@/components/articles/ArticleShareBar';
import { RelatedArticles } from '@/components/articles/RelatedArticles';
import { ArticleNewsletterCard } from '@/components/articles/ArticleNewsletterCard';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

// Verbatim from design/static_html/article.html — real product copy (legal disclaimer), not
// prototype filler, so it's reproduced as-is rather than paraphrased.
const LEGAL_DISCLAIMER =
  "The views expressed in this article are those of the author and do not constitute legal, tax, or financial advice. This content is published for informational purposes only. Readers should seek independent professional advice before acting on any information contained herein.";

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

export default async function ArticleDetailPage({ params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();

  // Guest: per docs/user-stories.md US-01-03, a signed-out visitor gets the list-shape data
  // (title + excerpt) as a teaser, never the full body — GET /v1/articles/:id has no @Public(),
  // so this looks the article up in the already-public GET /v1/articles list instead of ever
  // calling the gated endpoint (which would just 401 for a guest).
  if (!sessionUser) {
    const publicArticles = await getArticlesServer();
    const preview = publicArticles.find((a) => a.id === params.id);
    if (!preview) notFound();
    return <ArticlePreview article={preview} />;
  }

  const article = await getArticleServer(params.id);
  if (!article) {
    notFound();
  }

  const [author, allArticles] = await Promise.all([
    getMemberServer(article.authorId),
    getArticlesServer(),
  ]);

  const summaryPoints = article.aiSummary?.split('\n').filter(Boolean) ?? [];

  return (
    <div>
      <div className="relative h-[320px] w-full overflow-hidden max-[640px]:h-[220px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={article.coverImageUrl} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <PageContainer className="absolute inset-x-0 bottom-0 flex items-center gap-3 pb-6">
          <Link href="/articles" className="text-sm font-medium text-white/80 hover:text-white">
            ← Articles
          </Link>
          {article.practiceAreas[0] && (
            <Badge variant="emphasis">{article.practiceAreas[0].name}</Badge>
          )}
        </PageContainer>
      </div>

      <PageContainer className="grid items-start gap-10 py-10 lg:grid-cols-[1fr_312px]">
        <article className="overflow-hidden rounded-3xl border border-line bg-bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02),0_24px_48px_-30px_rgba(0,0,0,0.22)]">
          <div className="px-6 pb-10 pt-8 min-[640px]:px-12 min-[640px]:pb-14 min-[640px]:pt-10">
            <h1 className="text-article-title text-ink">{article.title}</h1>

            <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                <span className="flex items-center gap-1.5 text-mono-label text-ink-3">
                  <svg {...META_ICON_PROPS}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {DATE_FORMAT.format(new Date(article.createdAt)).toUpperCase()}
                </span>
                <span className="flex items-center gap-1.5 text-mono-label text-ink-3">
                  <svg {...META_ICON_PROPS}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {article.readTimeMinutes} min read
                </span>
                <span className="flex items-center gap-1.5 text-mono-label text-ink-3">
                  <svg {...META_ICON_PROPS}>
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {article.authorName}
                </span>
                {article.country && (
                  <span className="flex items-center gap-1.5 text-mono-label text-ink-3">
                    <svg {...META_ICON_PROPS}>
                      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {article.country}
                  </span>
                )}
              </div>
              <ArticleShareBar title={article.title} />
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
              className="prose-article mt-8 text-[16px] leading-[1.75] tracking-[-0.003em] text-ink-2 [&_blockquote]:my-6 [&_blockquote]:rounded-r-[10px] [&_blockquote]:border-l-[3px] [&_blockquote]:border-accent [&_blockquote]:bg-bg-alt [&_blockquote]:px-[22px] [&_blockquote]:py-[18px] [&_blockquote]:font-serif [&_blockquote]:text-[17px] [&_blockquote]:italic [&_blockquote]:leading-[1.5] [&_blockquote]:text-ink [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-[clamp(17px,1.8vw,22px)] [&_h2]:font-medium [&_h2]:leading-[1.2] [&_h2]:tracking-[-0.02em] [&_h2]:text-ink [&_h3]:mb-2.5 [&_h3]:mt-6 [&_h3]:text-[16px] [&_h3]:font-medium [&_h3]:tracking-[-0.01em] [&_h3]:text-ink [&_li]:relative [&_li]:pl-[15px] [&_ol]:my-0 [&_ol]:mb-5 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_p]:mb-5 [&_p:last-child]:mb-0 [&_strong]:text-ink [&_ul]:my-0 [&_ul]:mb-5 [&_ul]:flex [&_ul]:list-none [&_ul]:flex-col [&_ul]:gap-2 [&_ul_li]:before:absolute [&_ul_li]:before:left-0 [&_ul_li]:before:top-[10px] [&_ul_li]:before:h-[5px] [&_ul_li]:before:w-[5px] [&_ul_li]:before:flex-none [&_ul_li]:before:rounded-full [&_ul_li]:before:bg-accent [&_a]:text-accent [&_a]:underline"
              // Safe: article.body is sanitised server-side (sanitize-html, allowlist of p/h2/h3/
              // ul/ol/li/blockquote/strong/em/a/br only) before it's ever stored — see
              // apps/backend/src/articles/articles.service.ts.
              dangerouslySetInnerHTML={{ __html: article.body }}
            />

            <p className="mt-9 rounded-[10px] border border-line bg-bg-alt px-[18px] py-3.5 text-mono-label leading-[1.65] tracking-[0.03em] text-ink-4">
              {LEGAL_DISCLAIMER}
            </p>
          </div>
        </article>

        <div className="flex flex-col gap-5 lg:sticky lg:top-10 lg:self-start">
          {author && <ArticleAuthorSidebar author={author} />}
          <RelatedArticles current={article} articles={allArticles} />
          <ArticleNewsletterCard />
        </div>
      </PageContainer>
    </div>
  );
}
