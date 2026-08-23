'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { signUpWithEmail } from '@/lib/auth/continue-with-email';

export function SignUpForm({
  returnTo,
  onSwitchToSignIn,
}: {
  returnTo: string;
  onSwitchToSignIn: () => void;
}) {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Retype-password match is a UI-only check — Supabase has no concept of a
    // confirm-password field, so this never reaches the network on mismatch.
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const result = await signUpWithEmail({
      firstName,
      lastName,
      email,
      password,
      city: city.trim() || undefined,
    });

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

      {/* Stacks to 1 column below 640px (this page's own mobile boundary,
          see login/page.tsx) — most phones are 375-430px wide, so a lower
          threshold like 400px still hit the 2-up grid on real devices and
          squeezed each field to ~150px. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="First name"
          name="firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          label="Last name"
          name="lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
      </div>

      <Input
        label="Work email"
        name="email"
        type="email"
        placeholder="you@firm.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <Input
        label="City (optional)"
        name="city"
        placeholder="e.g. London"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />

      <Input
        label="Password"
        name="password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
      />

      <Input
        label="Retype password"
        name="confirmPassword"
        type="password"
        placeholder="••••••••"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        minLength={8}
        required
      />

      <Button type="submit" disabled={submitting} fullWidth className="mt-1">
        {submitting ? 'Please wait…' : 'Sign up'}
        {!submitting && <span aria-hidden="true">→</span>}
      </Button>

      <p className="text-center text-[13px] text-ink-3">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="font-medium text-accent hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
