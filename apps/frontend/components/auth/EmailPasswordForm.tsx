'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/auth/FormField';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { continueWithEmail } from '@/lib/auth/continue-with-email';

export function EmailPasswordForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setCheckEmail(null);

    const result = await continueWithEmail({ email, password, firstName, lastName });

    if (result.status === 'signed_in') {
      router.push(returnTo);
      router.refresh();
      return;
    }
    if (result.status === 'check_email') {
      setCheckEmail(result.email);
      setSubmitting(false);
      return;
    }
    setError(result.message);
    setSubmitting(false);
  }

  if (checkEmail) {
    return (
      <div className="rounded-[10px] border border-line bg-bg-alt px-4 py-4 text-sm text-ink-2">
        Check your email — we&apos;ve sent a confirmation link to <strong>{checkEmail}</strong>.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ErrorBanner message={error} />

      {/* Not `required` — this single form/button handles both sign-in and
          sign-up (continueWithEmail tries sign-in first, falls back to
          sign-up), and name fields are irrelevant to a plain sign-in. Native
          HTML5 validation can't know which case applies ahead of time, so
          marking these required silently blocked every sign-in attempt where
          a returning user (correctly) left them blank — no visible error,
          just a form that refused to submit. Missing names on an actual
          signup are harmless: profiles.first_name/last_name fall back to ''
          via the DB trigger, same as any OAuth provider that omits them. */}
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="First name"
          name="firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <FormField
          label="Last name"
          name="lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>

      <FormField
        label="Work email"
        name="email"
        type="email"
        placeholder="you@firm.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <FormField
        label="Password"
        labelRight={
          <a href="/forgot-password" className="text-xs font-medium text-accent">
            Forgot?
          </a>
        }
        name="password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
      />

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[10px] bg-ink text-sm font-medium text-bg transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Please wait…' : 'Continue'}
        {!submitting && <span aria-hidden="true">→</span>}
      </button>
    </form>
  );
}
