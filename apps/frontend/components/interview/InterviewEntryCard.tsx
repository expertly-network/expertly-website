import { Button, Card } from '@/components/ui';
import { getMyInterviewServer } from '@/lib/api/server';

const COPY = {
  available: {
    title: 'Take your expert interview',
    body: 'A 20-minute voice conversation about your key engagements. It drafts a stronger profile for you to review.',
    cta: 'Start',
  },
  can_reconnect: {
    title: 'Continue your interview',
    body: 'Your call was interrupted. Pick up where you left off.',
    cta: 'Continue',
  },
  processing: {
    title: 'Preparing your interview drafts',
    body: 'We’ll email you when your drafts are ready to review.',
    cta: 'View',
  },
  completed: {
    title: 'Your interview drafts are ready',
    body: 'Review your summary and profile drafts.',
    cta: 'Review',
  },
} as const;

export async function InterviewEntryCard() {
  let status;
  try {
    status = await getMyInterviewServer();
  } catch {
    return null; // a dashboard panel never breaks the page
  }
  if (!status) return null;
  const copy = COPY[status.eligibility as keyof typeof COPY];
  if (!copy) return null;
  if (status.eligibility === 'completed' && status.interview?.summaryStatus === 'approved') return null; // done
  return (
    <Card padding="md" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-title text-ink">{copy.title}</h2>
        <p className="mt-1 text-sm text-ink-3">{copy.body}</p>
      </div>
      <Button href="/dashboard/interview" className="sm:shrink-0">
        {copy.cta}
      </Button>
    </Card>
  );
}
