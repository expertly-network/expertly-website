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
import { TERMS_OF_SERVICE_URL, PRIVACY_POLICY_URL } from '@/lib/legal';

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
    // Passive clickwrap — no separate confirmation step. Continuing (any path: email or
    // LinkedIn) is itself the acceptance; there's no enforced gate behind it. See AuthCard's
    // render for the actual linked version of this text.
    foot: "By continuing, you agree to Expertly's Terms of Service.",
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
  // Only the User tab's explicit "Sign up" view unambiguously means "create
  // an account" before ever calling LinkedIn — that's the one case consent
  // can be collected upfront. A plain "Sign in" click (either tab) might
  // turn out to create a new account anyway (first LinkedIn login), but that
  // can only be discovered after the OAuth round-trip — see
  // app/auth/callback/route.ts and ConfirmSignupCard for that path.
  const [signupConsent, setSignupConsent] = useState(false);
  const copy = COPY[mode][authView];
  const requiresUpfrontConsent = mode === 'user' && authView === 'signup';

  async function handleLinkedIn() {
    setLinkedinPending(true);
    setLinkedinError(null);
    // `mode` doubles as the OAuth intent: 'member' triggers the post-login
    // member-vs-not-yet-a-member check in app/auth/callback/route.ts.
    const { error } = await signInWithLinkedIn(returnTo, mode, requiresUpfrontConsent && signupConsent);
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
          setSignupConsent(false);
        }}
      />

      <Card>
        <h1 className="text-heading text-ink">{copy.title}</h1>
        <p className="mb-7 mt-2.5 text-lede text-ink-3">{copy.sub}</p>

        <div className="flex flex-col gap-2">
          <ErrorBanner message={linkedinError} />
          {requiresUpfrontConsent && (
            <label className="flex items-start gap-2.5 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={signupConsent}
                onChange={(e) => setSignupConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none rounded border-line-2 accent-accent"
              />
              <span>I agree to Expertly&apos;s Terms of Service and Privacy Policy.</span>
            </label>
          )}
          <SsoButton
            provider="linkedin"
            onClick={handleLinkedIn}
            disabled={linkedinPending || (requiresUpfrontConsent && !signupConsent)}
          />
        </div>

        {mode === 'user' && (
          <>
            <div className="my-5 flex items-center gap-3 text-[11px] tracking-[0.1em] text-ink-3">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
            {authView === 'signin' ? (
              <SignInForm
                returnTo={returnTo}
                onSwitchToSignUp={() => {
                  setAuthView('signup');
                  setSignupConsent(false);
                }}
              />
            ) : (
              <SignUpForm
                returnTo={returnTo}
                onSwitchToSignIn={() => {
                  setAuthView('signin');
                  setSignupConsent(false);
                }}
              />
            )}
          </>
        )}

        {mode === 'member' && <MemberBenefitsPanel />}

        {mode === 'user' ? (
          <p className="mt-5 text-center text-[13px] text-ink-3">
            By continuing, you agree to Expertly&apos;s{' '}
            <a
              href={TERMS_OF_SERVICE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-ink-2"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-ink-2"
            >
              Privacy Policy
            </a>
            .
          </p>
        ) : (
          <p className="mt-5 text-center text-[13px] text-ink-3">{COPY[mode].foot}</p>
        )}
      </Card>
    </>
  );
}
