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
  /** audioOptIn: keep the call recording after processing (only asked on first start). */
  onStart: (audioOptIn: boolean) => void;
}) {
  const [agreed, setAgreed] = useState(mode === 'reconnect');
  const [keepAudio, setKeepAudio] = useState(false);
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <p className="text-eyebrow uppercase tracking-wide text-accent">Expert interview</p>
      <h1 className="mt-2 text-heading text-ink">
        {mode === 'reconnect' ? 'Pick up where you left off' : 'Tell us about the work you’re proudest of'}
      </h1>
      <p className="mt-3 text-ink-3">
        {mode === 'reconnect'
          ? `Your call was interrupted. You can continue until ${reconnectUntil ? formatDate(reconnectUntil) : 'tomorrow'}; we’ll carry on from the same point.`
          : 'A 15-minute voice conversation with our AI interviewer about a few engagements you’ve worked on. It already knows your profile, so it goes deeper on specific work rather than repeating it. You can take it once.'}
      </p>
      {mode === 'start' && (
        <Card padding="md" className="mt-6">
          <ul className="space-y-2 text-sm text-ink-2">
            <li>• About 15 minutes, voice only. Find a quiet place and use headphones if you can.</li>
            <li>
              • The interviewer is an AI. Afterwards, AI reviews your answers to suggest precise expertise tags and
              draft profile updates, and our team may review how well the interview supported each part of your profile.
            </li>
            <li>
              • We keep the transcript. The audio recording is deleted once your interview is processed, unless you
              choose to keep it below.
            </li>
            <li>
              • You’ll review the suggested tags and draft updates. Nothing changes on your profile until you approve
              and our team accepts.
            </li>
            <li>• A short summary you approve may be used by GrowXQ search to match and quote you.</li>
            <li>• Never share client names you’re not allowed to; industry, size and year are enough.</li>
          </ul>
          <label className="mt-5 flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-ink"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>I agree to the interview and to my answers being used as described above.</span>
          </label>
          <label className="mt-1 flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-ink-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-ink"
              checked={keepAudio}
              onChange={(e) => setKeepAudio(e.target.checked)}
            />
            <span>Optional: keep my audio recording too, so the team can listen back if needed.</span>
          </label>
        </Card>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}
      <Button className="mt-6" fullWidth onClick={() => onStart(keepAudio)} disabled={!agreed || starting}>
        {starting ? 'Preparing your interview…' : mode === 'reconnect' ? 'Reconnect' : 'Start interview'}
      </Button>
    </div>
  );
}
