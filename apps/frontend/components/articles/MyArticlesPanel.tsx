'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WriteArticleCtaButton } from '@/components/articles/WriteArticleCtaButton';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/client';
import { deleteArticle, updateArticle } from '@/lib/api/articles';
import type { ArticleListItemDto, ArticleStatus } from '@shared/article';

type PendingAction = { kind: 'delete' | 'unpublish'; article: ArticleListItemDto };

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

// Own articles regardless of status, each with a status badge overlaid on the cover image.
const STATUS_BADGE: Record<ArticleStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-ink-3' },
  pending_review: { label: 'Pending review', className: 'bg-amber-600' },
  published: { label: 'Published', className: 'bg-accent' },
  rejected: { label: 'Rejected', className: 'bg-error' },
};

export function MyArticlesPanel({ articles }: { articles: ArticleListItemDto[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmAction() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'delete') await deleteArticle(pending.article.id);
      else await updateArticle(pending.article.id, { status: 'draft' });
      setPending(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (articles.length === 0) {
    return (
      <div className="mx-auto max-w-[420px] rounded-[18px] border border-dashed border-line-2 bg-bg-card px-8 py-12 text-center">
        <div className="mx-auto mb-[18px] flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-accent">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
        </div>
        <p className="mb-2 text-[17px] font-semibold text-ink">You haven&apos;t published anything yet</p>
        <p className="mb-[22px] text-[13.5px] leading-[1.55] text-ink-3">
          Write your first article and it&apos;ll show up here — including anything still waiting on editorial review.
        </p>
        <WriteArticleCtaButton />
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => {
          const badge = STATUS_BADGE[article.status];
          return (
            // A plain `<div>`, not `<Link>` — the edit button below is a sibling anchor, and
            // nesting an `<a>` inside another `<a>` is invalid HTML.
            <div
              key={article.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-bg-card transition-colors hover:border-line-2"
            >
              <Link href={`/articles/${article.slug}`} className="flex flex-1 flex-col">
                <div className="relative">
                  <span
                    className={`absolute left-3 top-3 z-[2] rounded-full px-2.5 py-1 text-[10px] font-bold text-bg-card ${badge.className}`}
                  >
                    {badge.label.toUpperCase()}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    loading="lazy"
                    decoding="async"
                    src={article.coverImageUrl}
                    alt=""
                    className="h-[140px] w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span className="mb-2 text-xs text-ink-3">{DATE_FORMAT.format(new Date(article.createdAt))}</span>
                  <h3 className="line-clamp-2 text-title text-ink">{article.title}</h3>
                  {article.status === 'rejected' && article.rejectionReason && (
                    <p className="mt-2 text-xs text-error">{article.rejectionReason}</p>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-4 border-t border-line px-5 py-3 text-xs font-medium">
                {article.status === 'published' && (
                  <button
                    type="button"
                    onClick={() => setPending({ kind: 'unpublish', article })}
                    className="text-ink-3 transition-colors hover:text-ink"
                  >
                    Unpublish
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPending({ kind: 'delete', article })}
                  className="text-ink-3 transition-colors hover:text-error"
                >
                  Delete
                </button>
              </div>
              <Link
                href={`/articles/write?edit=${article.id}`}
                aria-label="Edit article"
                title="Edit article"
                className="absolute right-3 top-3 z-[2] flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Link>
            </div>
          );
        })}
      </div>

      <Modal
        open={pending !== null}
        onClose={() => (busy ? undefined : setPending(null))}
        title={pending?.kind === 'delete' ? 'Delete this article?' : 'Unpublish this article?'}
      >
        <p className="text-sm text-ink-2">
          {pending?.kind === 'delete'
            ? `“${pending.article.title}” will be permanently deleted. This can't be undone.`
            : `“${pending?.article.title ?? ''}” will move back to your drafts and stop being visible to readers. You can publish it again later.`}
        </p>
        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirmAction} disabled={busy}>
            {busy ? 'Working…' : pending?.kind === 'delete' ? 'Delete article' : 'Unpublish'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
