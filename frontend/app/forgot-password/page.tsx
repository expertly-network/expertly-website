'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { FormField } from '@/components/auth/FormField';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { createClient } from '@/lib/supabase/client';
import { mapAuthError } from '@/lib/auth/errors';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);
    if (resetError) {
      setError(mapAuthError(resetError));
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-[440px] rounded-[20px] border border-line bg-bg-card p-10 max-[640px]:p-6">
        <h1 className="text-[32px] font-medium leading-[1.1] text-ink">Reset your password.</h1>
        <p className="mb-7 mt-2.5 text-[15px] text-ink-3">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

        {sent ? (
          <div className="rounded-[10px] border border-line bg-bg-alt px-4 py-4 text-sm text-ink-2">
            Check your email — we&apos;ve sent a password reset link to <strong>{email}</strong>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <ErrorBanner message={error} />
            <FormField
              label="Work email"
              name="email"
              type="email"
              placeholder="you@firm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex min-h-[48px] w-full items-center justify-center rounded-[10px] bg-ink text-sm font-medium text-bg transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-[13px] text-ink-3">
          <Link href="/login" className="font-medium text-accent">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
