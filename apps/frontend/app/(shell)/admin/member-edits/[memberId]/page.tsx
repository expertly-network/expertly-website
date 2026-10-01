import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminMemberEditsDetailServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { MemberEditsReview } from '@/components/admin/MemberEditsReview';

export const metadata = {
  title: 'Review profile edits — Admin — Expertly',
};

export default async function AdminMemberEditsDetailPage({ params }: { params: { memberId: string } }) {
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/admin/member-edits/${params.memberId}`);
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const detail = await getAdminMemberEditsDetailServer(params.memberId);
  if (!detail) {
    notFound();
  }

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          {/* `flex w-fit`, not inline-flex — keeps the back link on its own line above the eyebrow. */}
          <Link
            href="/admin/member-edits"
            className="mb-6 flex w-fit items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All profile edits
          </Link>
          <Eyebrow dark>Admin · Profile edits</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">{detail.member.name}</h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Compare each proposed section with what&apos;s live now, check the proof, then approve or
            reject it.
          </p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <MemberEditsReview detail={detail} />
        </PageContainer>
      </section>
    </div>
  );
}
