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
    // Members/admins have no reason to be here — this flow only ever
    // creates client-submitted applications (backend enforces this too,
    // see docs/rest-api.md's POST /v1/applications).
    redirect('/dashboard');
  }

  // Mirrors the backend's own duplicate-application rule exactly (see
  // ApplicationsService.create) — only submitted/under_review blocks a new
  // one; approved/rejected are allowed to re-apply, so only redirect for
  // the two blocking statuses.
  const existing = await getMyApplicationServer();
  if (existing && (existing.status === 'submitted' || existing.status === 'under_review')) {
    redirect('/apply/submitted');
  }

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[1150px] px-6 py-10 max-[900px]:px-5">
        <Logo variant="auth" className="mb-10" />
        <ApplicationWizard />
      </div>
    </main>
  );
}
