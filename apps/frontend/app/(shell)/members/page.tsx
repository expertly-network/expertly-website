import { getMembersServer, getPracticeAreasServer } from '@/lib/api/server';
import { buildMembersQueryString } from '@/lib/api/members';
import { MEMBER_LIST_PAGE_SIZE, parseMemberFilters } from '@/lib/members/search-params';
import { DirectoryHeroSearch } from '@/components/members/DirectoryHeroSearch';
import { DirectoryFilterBar } from '@/components/members/DirectoryFilterBar';
import { DirectorySidebar } from '@/components/members/DirectorySidebar';
import { MemberDirectoryList } from '@/components/members/MemberDirectoryList';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';

const PAGE_SIZE = MEMBER_LIST_PAGE_SIZE;

export const metadata = {
  title: 'Members — Expertly',
  description:
    'Hire verified finance & legal counsel. Every practitioner is individually credential-verified and peer-reviewed.',
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseMemberFilters(searchParams);
  const query = buildMembersQueryString({ ...filters, page: 1, pageSize: PAGE_SIZE });

  const [members, practiceAreas] = await Promise.all([
    getMembersServer(query),
    getPracticeAreasServer(),
  ]);

  return (
    <div>
      {/* Dark hero band, matching design/static_html/members.html — a decorative
          constellation replaces the design's canvas-drawn particle motif (reasonable
          simplification, same call as the homepage hero's own decorative elements). */}
      <section className="relative overflow-hidden bg-ink py-16">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 top-0 hidden h-full w-[420px] opacity-40 lg:block"
          viewBox="0 0 420 300"
          fill="none"
        >
          <g stroke="var(--accent)" strokeWidth="0.5" opacity="0.5">
            <line x1="40" y1="60" x2="120" y2="30" />
            <line x1="120" y1="30" x2="200" y2="90" />
            <line x1="200" y1="90" x2="150" y2="160" />
            <line x1="150" y1="160" x2="260" y2="200" />
            <line x1="260" y1="200" x2="340" y2="140" />
            <line x1="200" y1="90" x2="300" y2="70" />
          </g>
          <g fill="var(--accent)">
            <circle cx="40" cy="60" r="3" />
            <circle cx="120" cy="30" r="2" />
            <circle cx="200" cy="90" r="3.5" />
            <circle cx="150" cy="160" r="2.5" />
            <circle cx="260" cy="200" r="3" />
            <circle cx="340" cy="140" r="2" />
            <circle cx="300" cy="70" r="2.5" />
          </g>
        </svg>

        <PageContainer className="relative">
          <Eyebrow dark>Member directory</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">
            Hire verified <span className="text-accent">finance &amp; legal</span> counsel.
          </h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Every practitioner below has been individually credential-verified and
            peer-reviewed. No agencies, no intermediaries, direct access only.
          </p>
          <div className="mt-8 max-w-2xl">
            <DirectoryHeroSearch filters={filters} />
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-10">
        <div className="grid grid-cols-[1fr_320px] items-start gap-8 max-[1023px]:grid-cols-1">
          <div>
            <DirectoryFilterBar practiceAreas={practiceAreas} filters={filters} />
            <div className="mt-6">
              <MemberDirectoryList initialMembers={members} filters={filters} />
            </div>
          </div>
          <DirectorySidebar />
        </div>
      </PageContainer>
    </div>
  );
}
