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

  // Full-bleed — no centered/boxed wrapper. Matches design/static_html/apply.html's actual
  // .apply-grid CSS (grid-template-columns: 360px 1fr; min-height: 100vh), which fills the
  // viewport edge to edge; ApplicationWizard owns that grid directly, same pattern AuthLayout
  // already uses for /login (an absolutely-positioned Logo over a full min-h-screen grid).
  return (
    <main className="relative min-h-screen">
      <Logo variant="auth" className="absolute left-8 top-8 z-10" />
      <ApplicationWizard />
    </main>
  );
}
