'use client';

import { useState } from 'react';
import { AuthTabs, type AuthMode } from '@/components/auth/AuthTabs';
import { EmailPasswordForm } from '@/components/auth/EmailPasswordForm';
import { SsoButton } from '@/components/auth/SsoButton';
import { MemberBenefitsPanel } from '@/components/auth/MemberBenefitsPanel';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { signInWithLinkedIn } from '@/lib/auth/linkedin';

const COPY: Record<AuthMode, { title: string; sub: string; foot: string }> = {
  user: {
    title: 'Get started with Expertly.',
    sub: 'Sign in or create a client account to search experts and book consultations.',
    foot: "By continuing, you agree to Expertly's Terms of Service.",
  },
  member: {
    title: 'Welcome, Member.',
    sub: 'Sign in or connect your LinkedIn account to access the verified network.',
    foot: 'LinkedIn authentication is required to access member-only profile editing.',
  },
};

export function AuthCard({
  initialMode,
  returnTo,
}: {
  initialMode: AuthMode;
  returnTo: string;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [linkedinPending, setLinkedinPending] = useState(false);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const copy = COPY[mode];

  async function handleLinkedIn() {
    setLinkedinPending(true);
    setLinkedinError(null);
    const { error } = await signInWithLinkedIn(returnTo);
    if (error) {
      setLinkedinError(error);
      setLinkedinPending(false);
    }
    // On success, Supabase redirects the browser away — no further state to set.
  }

  return (
    <>
      <AuthTabs mode={mode} onChange={setMode} />

      <div className="rounded-card border border-line bg-bg-card p-10 max-[640px]:px-6 max-[640px]:py-7">
        <h1 className="text-heading text-ink">{copy.title}</h1>
        <p className="mb-7 mt-2.5 text-[15px] text-ink-3">{copy.sub}</p>

        <div className="flex flex-col gap-2">
          <ErrorBanner message={linkedinError} />
          <SsoButton provider="linkedin" onClick={handleLinkedIn} disabled={linkedinPending} />
        </div>

        {mode === 'user' && (
          <>
            <div className="my-5 flex items-center gap-3 text-[11px] tracking-[0.1em] text-ink-3">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
            <EmailPasswordForm returnTo={returnTo} />
          </>
        )}

        {mode === 'member' && <MemberBenefitsPanel />}

        <p className="mt-5 text-center text-[13px] text-ink-3">{copy.foot}</p>
      </div>
    </>
  );
}
