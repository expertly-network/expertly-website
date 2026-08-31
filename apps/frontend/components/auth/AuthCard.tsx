'use client';

import { useState } from 'react';
import { AuthTabs, type AuthMode } from '@/components/auth/AuthTabs';
import { SignInForm } from '@/components/auth/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { SsoButton } from '@/components/auth/SsoButton';
import { MemberBenefitsPanel } from '@/components/auth/MemberBenefitsPanel';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { Card } from '@/components/ui/Card';
import { signInWithLinkedIn } from '@/lib/auth/linkedin';

type AuthView = 'signin' | 'signup';

const COPY: Record<AuthMode, Record<AuthView, { title: string; sub: string }> & { foot: string }> = {
  user: {
    signin: {
      title: 'Welcome back.',
      sub: 'Sign in to search experts and book consultations.',
    },
    signup: {
      title: 'Become a user.',
      sub: 'Create a client account to search experts and book consultations.',
    },
    // Passive disclosure, not a gate — the real, recorded consent (Terms/Privacy + email
    // preference) happens on the mandatory post-signup screen every new/unconsented signup is
    // routed through (middleware.ts), regardless of path. This line exists so nobody's
    // surprised by that screen, not to do the consenting itself. See docs/auth.md.
    foot: "By continuing, you'll be asked to agree to Expertly's Terms of Service and Privacy Policy.",
  },
  member: {
    signin: {
      title: 'Welcome, Member.',
      sub: 'Sign in or connect your LinkedIn account to access the verified network.',
    },
    signup: {
      title: 'Welcome, Member.',
      sub: 'Sign in or connect your LinkedIn account to access the verified network.',
    },
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
  const [authView, setAuthView] = useState<AuthView>('signin');
  const [linkedinPending, setLinkedinPending] = useState(false);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const copy = COPY[mode][authView];

  async function handleLinkedIn() {
    setLinkedinPending(true);
    setLinkedinError(null);
    // `mode` doubles as the OAuth intent: 'member' triggers the post-login
    // member-vs-not-yet-a-member check in app/auth/callback/route.ts.
    const { error } = await signInWithLinkedIn(returnTo, mode);
    if (error) {
      setLinkedinError(error);
      setLinkedinPending(false);
    }
    // On success, Supabase redirects the browser away — no further state to set.
  }

  return (
    <>
      <AuthTabs
        mode={mode}
        onChange={(next) => {
          setMode(next);
          setAuthView('signin');
        }}
      />

      <Card>
        <h1 className="text-heading text-ink">{copy.title}</h1>
        <p className="mb-7 mt-2.5 text-lede text-ink-3">{copy.sub}</p>

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
            {authView === 'signin' ? (
              <SignInForm returnTo={returnTo} onSwitchToSignUp={() => setAuthView('signup')} />
            ) : (
              <SignUpForm returnTo={returnTo} onSwitchToSignIn={() => setAuthView('signin')} />
            )}
          </>
        )}

        {mode === 'member' && <MemberBenefitsPanel />}

        <p className="mt-5 text-center text-[13px] text-ink-3">{COPY[mode].foot}</p>
      </Card>
    </>
  );
}
