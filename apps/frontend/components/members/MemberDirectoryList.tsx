'use client';

import { useEffect, useRef, useState } from 'react';
import { MemberCard } from '@/components/members/MemberCard';
import { Button } from '@/components/ui';
import { getMembers } from '@/lib/api/members';
import { ApiError } from '@/lib/api/client';
import type { MemberListItemDto } from '@shared/member';
import { MEMBER_LIST_PAGE_SIZE, type MemberFilters } from '@/lib/members/search-params';

const PAGE_SIZE = MEMBER_LIST_PAGE_SIZE;

export function MemberDirectoryList({
  initialMembers,
  filters,
}: {
  initialMembers: MemberListItemDto[];
  filters: MemberFilters;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialMembers.length === PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filters changed (new URL) — reset to the server-provided first page.
  useEffect(() => {
    setMembers(initialMembers);
    setPage(1);
    setHasMore(initialMembers.length === PAGE_SIZE);
    setError(null);
  }, [initialMembers]);

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) {
          loadMore();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, page, filters]);

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const results = await getMembers({ ...filters, page: nextPage, pageSize: PAGE_SIZE });
      setMembers((prev) => [...prev, ...results]);
      setPage(nextPage);
      setHasMore(results.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load more members.');
    } finally {
      setLoading(false);
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
          <MemberCard key={member.id} member={member} />
        ))}
        {loading &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-[260px] animate-pulse rounded-card bg-bg-alt" />
          ))}
      </div>
      {error && (
        <div className="mt-4 flex items-center justify-between rounded-input border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={loadMore} className="font-medium underline">
            Retry
          </button>
        </div>
      )}
      <div ref={sentinelRef} className="h-px" />
    </div>
  );
}
