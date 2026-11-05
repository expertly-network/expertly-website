'use client';

import { useState } from 'react';
import { SignInForm } from '@/components/auth/SignInForm';
import { SsoButton } from '@/components/auth/SsoButton';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { Card } from '@/components/ui/Card';
import { signInWithLinkedIn } from '@/lib/auth/linkedin';
import { USER_AGREEMENT_URL, PRIVACY_POLICY_URL } from '@/lib/consent';

// Pre-launch (SITE_LAUNCHED=false) replacement for AuthCard: the site is invite-only, so there's
// no User/Member toggle and no email sign-up — the application requires LinkedIn anyway, so it's
// the one way in. Signs in with the 'member' intent, which sends anyone who isn't a member yet on
// to /apply (app/auth/callback/route.ts).
// `emailSignIn` (/login?mode=email, linked from nowhere) is the admins' door: their accounts are
// email/password, and they still need to reach /admin before launch. Sign-in only, no sign-up.
export function InviteOnlyAuthCard({ returnTo, emailSignIn }: { returnTo: string; emailSignIn: boolean }) {
  const [linkedinPending, setLinkedinPending] = useState(false);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);

  async function handleLinkedIn() {
    setLinkedinPending(true);
    setLinkedinError(null);
    const { error } = await signInWithLinkedIn(returnTo, 'member');
    if (error) {
      setLinkedinError(error);
      setLinkedinPending(false);
    }
    // On success, Supabase redirects the browser away — no further state to set.
  }

  return (
    <Card>
      <h1 className="text-heading text-ink">{emailSignIn ? 'Sign in.' : 'Welcome to GrowXQ.'}</h1>
      <p className="mb-7 mt-2.5 text-lede text-ink-3">
        {emailSignIn
          ? 'Sign in with your email and password.'
          : 'GrowXQ is invite-only for now. Continue with LinkedIn to sign in or apply for membership.'}
      </p>

      {emailSignIn ? (
        <SignInForm returnTo={returnTo} />
      ) : (
        <div className="flex flex-col gap-2">
          <ErrorBanner message={linkedinError} />
          <SsoButton provider="linkedin" onClick={handleLinkedIn} disabled={linkedinPending} />
        </div>
      )}

      <p className="mt-5 text-center text-[13px] text-ink-3">
        By continuing, you agree to GrowXQ&apos;s{' '}
        <a href={USER_AGREEMENT_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink-2">
          User Agreement
        </a>{' '}
        and{' '}
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink-2">
          Privacy Policy
        </a>
        .
      </p>
    </Card>
  );
}
