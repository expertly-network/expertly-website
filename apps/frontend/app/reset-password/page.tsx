'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { createClient } from '@/lib/supabase/client';
import { mapAuthError } from '@/lib/auth/errors';

// Landing page for the emailed reset-password link. Supabase's browser client
// auto-establishes a recovery session from the URL when this page loads
// (detectSessionInUrl is on by default), so this just needs to call updateUser.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(mapAuthError(updateError));
      setSubmitting(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <AuthLayout>
      <Card>
        <h1 className="text-heading text-ink">Choose a new password.</h1>
        <p className="mb-7 mt-2.5 text-[15px] text-ink-3">
          Enter a new password for your Expertly account.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ErrorBanner message={error} />
          <Input
            label="New password"
            name="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <Input
            label="Retype new password"
            name="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
          <Button type="submit" disabled={submitting} fullWidth className="mt-1">
            {submitting ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      </Card>
    </AuthLayout>
  );
}
