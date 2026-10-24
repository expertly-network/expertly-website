import { notFound, redirect } from 'next/navigation';
import { getMyMemberProfileServer } from '@/lib/api/server';
import { getSessionUser } from '@/lib/auth/session-claims';

// Stable "my profile" link (e.g. the home hero's "View my profile") — resolves the signed-in
// member's slug server-side and redirects to their real profile URL.
export default async function MyProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?returnTo=%2Fmembers%2Fme');

  const mine = await getMyMemberProfileServer();
  if (!mine) notFound();
  redirect(`/members/${mine.slug}`);
}
