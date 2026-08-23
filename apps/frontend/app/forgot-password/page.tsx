'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
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
    <AuthLayout>
      <Card>
        <h1 className="text-heading text-ink">Reset your password.</h1>
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
            <Input
              label="Work email"
              name="email"
              type="email"
              placeholder="you@firm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" disabled={submitting} fullWidth className="mt-1">
              {submitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-[13px] text-ink-3">
          <Link href="/login" className="font-medium text-accent">
            Back to sign in
          </Link>
        </p>
      </Card>
    </AuthLayout>
  );
}
