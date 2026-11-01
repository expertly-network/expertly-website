import { getMembersPageServer, getCategoriesServer } from '@/lib/api/server';
import { buildMembersQueryString } from '@/lib/api/members';
import { MEMBER_LIST_PAGE_SIZE, parseMemberFilters, parseMemberPage } from '@/lib/members/search-params';
import { getSessionUser } from '@/lib/auth/session-claims';
import { canApplyForMembership } from '@/lib/auth/roles';
import { DirectoryHeroSearch } from '@/components/members/DirectoryHeroSearch';
import { DirectoryFilterBar } from '@/components/members/DirectoryFilterBar';
import { DirectorySidebar } from '@/components/members/DirectorySidebar';
import { MemberDirectoryList } from '@/components/members/MemberDirectoryList';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { HeroConstellation } from '@/components/layout/HeroConstellation';

const PAGE_SIZE = MEMBER_LIST_PAGE_SIZE;

export const metadata = {
  title: 'Members — GrowXQ',
  description:
    'Hire verified finance & legal counsel. Every practitioner is individually credential-verified and peer-reviewed.',
};

export default async function MembersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const filters = parseMemberFilters(searchParams);
  const page = parseMemberPage(searchParams);
  const query = buildMembersQueryString({ ...filters, page, pageSize: PAGE_SIZE });

  const [{ items: members, total }, categories, sessionUser] = await Promise.all([
    getMembersPageServer(query),
    getCategoriesServer(),
    getSessionUser(),
  ]);
  const viewerId = sessionUser?.id;
  const viewerName = sessionUser ? `${sessionUser.first_name} ${sessionUser.last_name}`.trim() : undefined;
  const viewerEmail = sessionUser?.email;

  return (
    <div>
      <PageHero
        eyebrow="Member directory"
        title={
          <>
            Hire verified <span className="text-accent">finance &amp; legal</span> counsel.
          </>
        }
        lede="Every practitioner below has been individually credential-verified and peer-reviewed. No agencies, no intermediaries, direct access only."
        search={<DirectoryHeroSearch filters={filters} />}
        decoration={<HeroConstellation />}
      />

      <PageContainer className="py-10">
        <div className="grid grid-cols-[1fr_320px] items-start gap-8 max-[1023px]:grid-cols-1">
          <div>
            <DirectoryFilterBar categories={categories} filters={filters} />
            <div className="mt-6">
              <MemberDirectoryList
                members={members}
                total={total}
                page={page}
                filters={filters}
                viewerId={viewerId}
                viewerName={viewerName}
                viewerEmail={viewerEmail}
              />
            </div>
          </div>
          <DirectorySidebar showApply={canApplyForMembership(sessionUser)} />
        </div>
      </PageContainer>
    </div>
  );
}
