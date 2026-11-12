'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import type { MemberDto } from '@shared/member';
import type { MyInterviewResponse, StartInterviewResponse } from '@shared/interview';
import { getMyInterview, startInterview } from '@/lib/api/interviews';
import { InterviewIntro } from './InterviewIntro';
import { InterviewLive } from './InterviewLive';
import { InterviewResults } from './InterviewResults';
import { interviewErrorMessage, MicBlockedError } from './interview-errors';

const POLL_MS = 10_000;

export function InterviewExperience({
  initial,
  firstName,
  member,
}: {
  initial: MyInterviewResponse;
  firstName: string;
  member: MemberDto | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [session, setSession] = useState<StartInterviewResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getMyInterview();
      setStatus(next);
      if (next.eligibility === 'completed') router.refresh(); // server re-renders with the member profile
    } catch {
      // keep the last known state; the next poll retries
    }
  }, [router]);

  // Processing: poll until the drafts are ready.
  useEffect(() => {
    if (session || status.eligibility !== 'processing') return;
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [session, status.eligibility, refresh]);

  async function onStart(audioOptIn: boolean) {
    setError(null);
    setStarting(true);
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop()); // permission only; the SDK opens its own stream
      } catch (error: unknown) {
        throw new MicBlockedError(
          error instanceof Error ? error.name : typeof error,
          error instanceof Error ? error.message : undefined
        );
      }
      setSession(await startInterview({ consentVersion: status.consentVersion, audioOptIn }));
    } catch (e: unknown) {
      setError(interviewErrorMessage(e));
    } finally {
      setStarting(false);
    }
  }

  if (session) {
    return (
      <InterviewLive
        session={session}
        firstName={firstName}
        onEnded={(reason) => {
          setSession(null);
          if (reason)
            setError(
              process.env.NODE_ENV === 'production'
                ? 'The voice connection ended unexpectedly.'
                : `Voice connection: ${reason.slice(0, 200)}`
            );
          // The webhook decides interrupted vs processing; give it a moment, then re-read.
          setChecking(true);
          setTimeout(() => void refresh().finally(() => setChecking(false)), 4000);
        }}
      />
    );
  }

  if (checking) return <StatusCard title="Wrapping up your call…" body="One moment while we save your interview." />;

  switch (status.eligibility) {
    case 'available':
      return <InterviewIntro mode="start" reconnectUntil={null} starting={starting} error={error} onStart={onStart} />;
    case 'can_reconnect':
      return (
        <InterviewIntro
          mode="reconnect"
          reconnectUntil={status.interview?.reconnectUntil ?? null}
          starting={starting}
          error={error}
          onStart={onStart}
        />
      );
    case 'in_progress':
      return (
        <StatusCard
          title="Your interview is open elsewhere"
          body="It looks like your interview is running in another window or device. Close it there, or wait a minute and refresh."
          error={error}
          action={
            <Button variant="secondary" onClick={() => void refresh()}>
              Refresh
            </Button>
          }
        />
      );
    case 'processing':
      return (
        <StatusCard
          title="Thank you, we’re preparing your drafts"
          body="We’re turning your interview into draft profile updates. This usually takes a few minutes; we’ll email you when they’re ready."
        />
      );
    case 'failed':
      return (
        <StatusCard
          title="We couldn’t process your interview"
          body="Something went wrong on our side. Our team has been notified and can reopen the interview for you; reach out via the contact page."
        />
      );
    case 'completed':
      return status.interview && member ? (
        <InterviewResults interview={status.interview} member={member} onChanged={() => void refresh()} />
      ) : (
        <StatusCard title="Your interview is complete" body="Refresh the page to see your drafts." />
      );
  }
}

function StatusCard({
  title,
  body,
  action,
  error,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  error?: string | null;
}) {
  return (
    <Card padding="md" className="mx-auto w-full max-w-[720px]">
      <h1 className="text-title text-ink">{title}</h1>
      <p className="mt-2 text-ink-3">{body}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}
