'use client';

import { MemberCard } from '@/components/members/MemberCard';
import { Button, Pagination } from '@/components/ui';
import type { MemberListItemDto } from '@shared/member';
import { filtersToSearchParams, MEMBER_LIST_PAGE_SIZE, type MemberFilters } from '@/lib/members/search-params';

// One server-rendered directory page. The page number lives in the URL (?page=), so the page bar
// is plain links: back/forward and shared links land on the same page. Changing a filter builds a
// URL without ?page=, which starts again at page 1.
export function MemberDirectoryList({
  members,
  total,
  page,
  filters,
  viewerId,
  viewerName,
  viewerEmail,
}: {
  members: MemberListItemDto[];
  total: number;
  page: number;
  filters: MemberFilters;
  viewerId?: string;
  viewerName?: string;
  viewerEmail?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / MEMBER_LIST_PAGE_SIZE));

  function hrefFor(target: number): string {
    const params = filtersToSearchParams(filters);
    if (target > 1) params.set('page', String(target));
    const qs = params.toString();
    return qs ? `/members?${qs}` : '/members';
  }

  if (members.length === 0) {
    // Past the last page (a stale or hand-edited ?page=) is not the same as no matches.
    const pastTheEnd = page > 1 && total > 0;
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-line py-16 text-center">
        <span className="text-mono-label text-ink-3">No results</span>
        <h3 className="text-title text-ink">
          {pastTheEnd ? 'There are no members on this page.' : 'No members match those filters.'}
        </h3>
        <Button href={pastTheEnd ? hrefFor(1) : '/members'} variant="secondary">
          {pastTheEnd ? 'Go to page 1' : 'Reset filters'}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 font-mono text-xs text-ink-3">
        {total} member{total === 1 ? '' : 's'}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
      </p>
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
      </div>
      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} className="mt-10" />
    </div>
  );
}
