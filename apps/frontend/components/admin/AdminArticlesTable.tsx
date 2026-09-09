'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Textarea } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { reviewArticle } from '@/lib/api/articles';
import { ApiError } from '@/lib/api/client';
import type { AdminArticleListItemDto } from '@shared/article';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

function AdminArticleRow({
  article,
  onDecided,
}: {
  article: AdminArticleListItemDto;
  onDecided: (id: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setError(null);
    setBusy('approve');
    try {
      await reviewArticle(article.id, { status: 'published' });
      onDecided(article.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve this article.');
      setBusy(null);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    setError(null);
    setBusy('reject');
    try {
      await reviewArticle(article.id, { status: 'rejected', rejectionReason: reason.trim() });
      onDecided(article.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject this article.');
      setBusy(null);
    }
  }

  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <td className="px-6 py-4">
        <Link href={`/articles/${article.id}`} className="font-medium text-ink hover:text-accent">
          {article.title}
        </Link>
        <div className="mt-1 text-xs text-ink-3">by {article.authorName}</div>
      </td>
      <td className="px-6 py-4 text-sm text-ink-2">
        {article.practiceAreas.map((p) => p.name).join(', ') || '—'}
      </td>
      <td className="px-6 py-4 text-sm text-ink-2">{article.countries.join(', ') || '—'}</td>
      <td className="px-6 py-4 text-xs text-ink-3">
        {DATE_FORMAT.format(new Date(article.createdAt)).toUpperCase()}
      </td>
      <td className="px-6 py-4">
        {!rejecting ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={approve} disabled={busy !== null}>
              {busy === 'approve' ? 'Publishing…' : 'Approve'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== null}>
              Reject
            </Button>
          </div>
        ) : (
          <div className="flex w-64 flex-col gap-2">
            <Textarea
              label="Rejection reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={reject} disabled={busy !== null}>
                {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={busy !== null}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {error && <div className="mt-2 max-w-64"><ErrorBanner message={error} /></div>}
      </td>
    </tr>
  );
}

// Mirrors AdminApplicationsTable's exact interaction shape (approve / reject-with-reason,
// reviewed rows leave the queue immediately) for the article editorial review queue — only ever
// populated when ARTICLES_REVIEW_MODE=editorial (see ArticlesService), otherwise permanently empty.
export function AdminArticlesTable({ initialArticles }: { initialArticles: AdminArticleListItemDto[] }) {
  const [articles, setArticles] = useState(initialArticles);

  function handleDecided(id: string) {
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }

  if (articles.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-3">All caught up — nothing left to review.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-line bg-bg-alt text-left text-xs font-medium text-ink-3">
            <th className="px-6 py-3">Article</th>
            <th className="px-6 py-3">Practice area(s)</th>
            <th className="px-6 py-3">Countries</th>
            <th className="px-6 py-3">Submitted</th>
            <th className="px-6 py-3">Decision</th>
          </tr>
        </thead>
        <tbody className="px-6">
          {articles.map((article) => (
            <AdminArticleRow key={article.id} article={article} onDecided={handleDecided} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
