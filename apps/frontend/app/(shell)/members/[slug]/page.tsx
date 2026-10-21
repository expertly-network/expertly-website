import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getMemberServer, getMyMemberEditsServer } from '@/lib/api/server';
import { ProfileAuthWall } from '@/components/members/ProfileAuthWall';
import { ProfileClient } from './ProfileClient';

// Resolved before the page streams, so an unknown slug's notFound() here returns a real HTTP 404
// (thrown from the page body, after loading.tsx has already flushed, it would still be a 200).
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { title: 'Member profile — Expertly' };
  const member = await getMemberServer(params.slug);
  if (!member) notFound();
  return {
    title: `${member.name} — Expertly`,
    description: member.headline ?? undefined,
  };
}

export default async function MemberProfilePage({ params }: { params: { slug: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return <ProfileAuthWall />;
  }

  const member = await getMemberServer(params.slug);
  if (!member) {
    notFound();
  }

  const isOwnProfile = sessionUser.id === member.id;
  const edits = isOwnProfile ? await getMyMemberEditsServer(member.id) : [];

  return (
    <ProfileClient
      member={member}
      edits={edits}
      isOwnProfile={isOwnProfile}
      viewerName={`${sessionUser.first_name} ${sessionUser.last_name}`.trim()}
      viewerEmail={sessionUser.email}
    />
  );
}
