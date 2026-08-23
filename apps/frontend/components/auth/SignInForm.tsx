'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { signInWithEmail } from '@/lib/auth/continue-with-email';

export function SignInForm({
  returnTo,
  onSwitchToSignUp,
}: {
  returnTo: string;
  onSwitchToSignUp: () => void;
}) {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signInWithEmail({ email, password });

    if (result.status === 'signed_in') {
      router.push(returnTo);
      router.refresh();
      return;
    }
    setError(result.status === 'error' ? result.message : null);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ErrorBanner message={error} />

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
        required
      />

      <Button type="submit" disabled={submitting} fullWidth className="mt-1">
        {submitting ? 'Please wait…' : 'Sign in'}
        {!submitting && <span aria-hidden="true">→</span>}
      </Button>

      <p className="text-center text-[13px] text-ink-3">
        Not a user?{' '}
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="font-medium text-accent hover:underline"
        >
          Become one
        </button>
      </p>
    </form>
  );
}
