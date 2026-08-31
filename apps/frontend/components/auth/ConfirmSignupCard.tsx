'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { apiFetch, ApiError } from '@/lib/api/client';
import type { ConsentStatusDto } from '@shared/consent';

// The universal post-signup consent gate — middleware.ts redirects any signed-in-but-
// unconsented request here (any path: email signup, LinkedIn signup, or a pre-existing account
// that predates this gate), not just the LinkedIn "turned out to be new" case this used to be
// scoped to. See docs/auth.md.
export function ConfirmSignupCard({ destination }: { destination: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<ConsentStatusDto>('/me/consent', {
        method: 'POST',
        body: JSON.stringify({ marketingConsent: true }),
      });

      // The JWT's consent_given claim was set at token-mint time (before this call) — refresh
      // now so the *next* request already carries the updated claim, instead of waiting for a
      // natural refresh up to ~1hr later. Without this, middleware would bounce them right back
      // here even though they just consented.
      const supabase = createClient();
      await supabase.auth.refreshSession();

      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <Card>
      <h1 className="text-heading text-ink">One more step</h1>
      <p className="mb-6 mt-2.5 text-[15px] text-ink-3">
        We need your consent to continue — you can change your email preferences anytime.
      </p>

      <label className="flex items-start gap-2.5 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none rounded border-line-2 accent-accent"
        />
        <span>
          I agree to Expertly&apos;s Terms of Service and Privacy Policy, and consent to receive
          occasional emails about new experts, articles, and product updates. You can unsubscribe
          anytime.
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-col gap-2.5">
        <Button type="button" onClick={handleContinue} disabled={!agreed || submitting} fullWidth>
          {submitting ? 'Please wait…' : 'Continue →'}
        </Button>
        <Button
          type="button"
          onClick={handleCancel}
          disabled={cancelling || submitting}
          variant="ghost"
          fullWidth
        >
          {cancelling ? 'Please wait…' : 'Sign out'}
        </Button>
      </div>
    </Card>
  );
}
