import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getMemberServer, getMyMemberEditsServer } from '@/lib/api/server';
import { ProfileAuthWall } from '@/components/members/ProfileAuthWall';
import { ProfileClient } from './ProfileClient';

export default async function MemberProfilePage({ params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return <ProfileAuthWall />;
  }

  const member = await getMemberServer(params.id);
  if (!member) {
    notFound();
  }

  const isOwnProfile = sessionUser.id === member.id;
  const edits = isOwnProfile ? await getMyMemberEditsServer(member.id) : [];

  return <ProfileClient member={member} edits={edits} isOwnProfile={isOwnProfile} />;
}
