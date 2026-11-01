import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getCategoriesServer, getMyApplicationServer } from '@/lib/api/server';
import { ApplicationWizard } from '@/components/apply/ApplicationWizard';
import { Logo } from '@/components/Logo';
import { homePathFor } from '@/lib/auth/roles';
import { isSiteLaunched } from '@/lib/env';
import { COUPON_COOKIE, cleanCouponCode } from '@/lib/launch';

export default async function ApplyPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/apply');
  }
  if (profile.role !== 'client') {
    // Before launch a member has nowhere else to go (every member page is closed) — their status
    // page tells them they're in.
    redirect(profile.role === 'member' && !isSiteLaunched() ? '/apply/submitted' : homePathFor(profile.role));
  }

  // Fetched here, once, and handed to the wizard — a failure throws to app/apply/error.tsx rather
  // than leaving the wizard on an empty form (or with no services to pick in step 4).
  const [existing, categories] = await Promise.all([getMyApplicationServer(), getCategoriesServer()]);

  // An in-progress or decided application has its own status page (the backend refuses to save over
  // it: APPLICATION_LOCKED). A rejected one isn't reused — the applicant starts a fresh application,
  // as the status page tells them they can.
  if (
    existing &&
    (existing.status === 'submitted' || existing.status === 'under_review' || existing.status === 'approved')
  ) {
    redirect('/apply/submitted');
  }
  const draft = existing?.status === 'draft' ? existing : null;
  // Set by middleware from a `?coupon=` link (the founding teaser's CTA).
  const linkCoupon = cleanCouponCode((await cookies()).get(COUPON_COOKIE)?.value);

  return (
    <main className="relative min-h-screen">
      <Logo variant="auth" className="absolute left-8 top-8 z-10" />
      <ApplicationWizard
        initialApplication={draft}
        accountEmail={profile.email}
        categories={categories}
        linkCoupon={linkCoupon}
        referencesRequired={isSiteLaunched()}
      />
    </main>
  );
}
