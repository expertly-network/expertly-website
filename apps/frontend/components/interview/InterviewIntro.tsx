'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { formatDate } from '@/lib/dates';

export function InterviewIntro({
  mode,
  reconnectUntil,
  starting,
  error,
  onStart,
}: {
  mode: 'start' | 'reconnect';
  reconnectUntil: string | null;
  starting: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const [agreed, setAgreed] = useState(mode === 'reconnect');
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <p className="text-eyebrow uppercase tracking-wide text-accent">Expert interview</p>
      <h1 className="mt-2 text-heading text-ink">
        {mode === 'reconnect' ? 'Pick up where you left off' : 'Tell us about the work you’re proudest of'}
      </h1>
      <p className="mt-3 text-ink-3">
        {mode === 'reconnect'
          ? `Your call was interrupted. You can continue until ${reconnectUntil ? formatDate(reconnectUntil) : 'tomorrow'}; we’ll carry on from the same point.`
          : 'A 20-minute voice conversation with our AI interviewer about your key engagements and expertise. It already knows your profile, so it focuses on what we don’t know yet. You can take it once.'}
      </p>
      {mode === 'start' && (
        <Card padding="md" className="mt-6">
          <ul className="space-y-2 text-sm text-ink-2">
            <li>• About 20 minutes, voice only. Find a quiet place and use headphones if you can.</li>
            <li>• The call is recorded (audio and transcript) and stored securely.</li>
            <li>
              • You’ll get draft profile updates to review. Nothing changes on your profile until you submit and our
              team approves.
            </li>
            <li>• A short summary you approve may be used by GrowXQ search to match and quote you.</li>
            <li>• Never share client names you’re not allowed to; industry and size are enough.</li>
          </ul>
          <label className="mt-5 flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-ink"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>I agree to the interview being recorded and used as described above.</span>
          </label>
        </Card>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}
      <Button className="mt-6" fullWidth onClick={onStart} disabled={!agreed || starting}>
        {starting ? 'Preparing your interview…' : mode === 'reconnect' ? 'Reconnect' : 'Start interview'}
      </Button>
    </div>
  );
}
