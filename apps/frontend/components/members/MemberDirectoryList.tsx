'use client';

import { useEffect, useRef, useState } from 'react';
import { MemberCard } from '@/components/members/MemberCard';
import { Button, Card } from '@/components/ui';
import { getMembers } from '@/lib/api/members';
import { ApiError } from '@/lib/api/client';
import type { MemberListItemDto } from '@shared/member';
import { MEMBER_LIST_PAGE_SIZE, type MemberFilters } from '@/lib/members/search-params';

const PAGE_SIZE = MEMBER_LIST_PAGE_SIZE;

export function MemberDirectoryList({
  initialMembers,
  filters,
  viewerId,
  viewerName,
  viewerEmail,
}: {
  initialMembers: MemberListItemDto[];
  filters: MemberFilters;
  viewerId?: string;
  viewerName?: string;
  viewerEmail?: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialMembers.length === PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the latest request may write state — a next-page response for the previous filters must
  // not be appended after the filters change (same pattern as ArticlesGrid).
  const requestId = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filters changed (new URL) — reset to the server-provided first page and drop any in-flight page.
  useEffect(() => {
    requestId.current += 1;
    setMembers(initialMembers);
    setPage(1);
    setHasMore(initialMembers.length === PAGE_SIZE);
    setLoading(false);
    setError(null);
  }, [initialMembers]);

  // Starts the next page ~400px before the end of the list. Paused while a request is in flight or
  // after a failure (the "Try again" button resumes), so a failing request can't retry in a loop.
  useEffect(() => {
    if (!hasMore || loading || error) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMore() reads the current page/filters
  }, [hasMore, loading, error, page, filters]);

  async function loadMore() {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const results = await getMembers({ ...filters, page: nextPage, pageSize: PAGE_SIZE });
      if (id !== requestId.current) return;
      setMembers((prev) => [...prev, ...results]);
      setPage(nextPage);
      setHasMore(results.length === PAGE_SIZE);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof ApiError ? err.message : 'Failed to load more members.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-line py-16 text-center">
        <span className="text-mono-label text-ink-3">No results</span>
        <h3 className="text-title text-ink">No members match those filters.</h3>
        <Button href="/members" variant="secondary">
          Reset filters
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-5">
        {members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            isOwnProfile={viewerId === member.id}
            viewerName={viewerName}
            viewerEmail={viewerEmail}
          />
        ))}
        {loading &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-[260px] animate-pulse rounded-card bg-bg-alt" />
          ))}
      </div>
      {error && !loading && (
        <Card padding="md" className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-3">Couldn&apos;t load more members. {error}</p>
          <Button variant="secondary" size="sm" onClick={() => void loadMore()}>
            Try again
          </Button>
        </Card>
      )}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
    </div>
  );
}
