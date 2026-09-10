import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getMyApplicationServer } from '@/lib/api/server';
import { ApplicationWizard } from '@/components/apply/ApplicationWizard';
import { Logo } from '@/components/Logo';

export default async function ApplyPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/apply');
  }
  if (profile.role !== 'client') {
    redirect('/dashboard');
  }

  // Only submitted/under_review blocks a new application.
  const existing = await getMyApplicationServer();
  if (existing && (existing.status === 'submitted' || existing.status === 'under_review')) {
    redirect('/apply/submitted');
  }

  return (
    <main className="relative min-h-screen">
      <Logo variant="auth" className="absolute left-8 top-8 z-10" />
      <ApplicationWizard />
    </main>
  );
}
