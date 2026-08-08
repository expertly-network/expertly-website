'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/auth/FormField';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { createClient } from '@/lib/supabase/client';
import { mapAuthError } from '@/lib/auth/errors';

// Landing page for the emailed reset-password link. Supabase's browser client
// auto-establishes a recovery session from the URL when this page loads
// (detectSessionInUrl is on by default), so this just needs to call updateUser.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

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
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-[440px] rounded-[20px] border border-line bg-bg-card p-10 max-[640px]:p-6">
        <h1 className="text-[32px] font-medium leading-[1.1] text-ink">Choose a new password.</h1>
        <p className="mb-7 mt-2.5 text-[15px] text-ink-3">
          Enter a new password for your Expertly account.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ErrorBanner message={error} />
          <FormField
            label="New password"
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
            className="mt-1 flex min-h-[48px] w-full items-center justify-center rounded-[10px] bg-ink text-sm font-medium text-bg transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </main>
  );
}
