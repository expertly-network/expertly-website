'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

// Shown once, right after a LinkedIn sign-in unexpectedly created a new
// account (see app/auth/callback/route.ts) — the one point in this flow
// where Terms/Privacy consent can actually be collected, since Supabase had
// already created the account as a side effect of the OAuth handshake
// itself by the time this page can know that happened.
export function ConfirmSignupCard({ destination }: { destination: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  function handleContinue() {
    router.push(destination);
    router.refresh();
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
      <h1 className="text-heading text-ink">Create your account?</h1>
      <p className="mb-6 mt-2.5 text-[15px] text-ink-3">
        We didn&apos;t find an existing Expertly account for that LinkedIn profile — confirm
        below to create one.
      </p>

      <label className="flex items-start gap-2.5 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none rounded border-line-2 accent-accent"
        />
        <span>I agree to Expertly&apos;s Terms of Service and Privacy Policy.</span>
      </label>

      <div className="mt-6 flex flex-col gap-2.5">
        <Button type="button" onClick={handleContinue} disabled={!agreed} fullWidth>
          Create my account →
        </Button>
        <Button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          variant="ghost"
          fullWidth
        >
          {cancelling ? 'Please wait…' : 'Cancel'}
        </Button>
      </div>
    </Card>
  );
}
