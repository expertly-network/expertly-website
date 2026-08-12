import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getMyApplicationServer } from '@/lib/api/server';
import { Logo } from '@/components/Logo';

const STATUS_COPY: Record<string, { badge: string; title: string; description: string }> = {
  submitted: {
    badge: 'In Review',
    title: 'Application under review',
    description:
      'We are reviewing your profile and credentials. You will receive an email update once completed.',
  },
  under_review: {
    badge: 'In Review',
    title: 'Application under review',
    description:
      'We are reviewing your profile and credentials. You will receive an email update once completed.',
  },
  approved: {
    badge: 'Approved',
    title: 'Application approved',
    description: 'Your membership is being set up — check back shortly.',
  },
  rejected: {
    badge: 'Not approved',
    title: 'Application not approved this time',
    description: 'You can submit a new application whenever you’re ready.',
  },
};

export default async function ApplicationSubmittedPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/apply/submitted');
  }

  const application = await getMyApplicationServer();
  if (!application) {
    redirect('/apply');
  }

  const copy = STATUS_COPY[application.status] ?? STATUS_COPY.submitted;
  const isRejected = application.status === 'rejected';

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[820px] px-6 py-10 max-[640px]:px-5">
        <Logo variant="auth" className="mb-10" />

        <div className="flex items-center gap-4 rounded-2xl border border-line bg-bg-card p-6">
          <div
            className={`flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full ${
              isRejected ? 'bg-red-50 text-red-600' : 'bg-nav-green text-white'
            }`}
          >
            {isRejected ? '!' : '✓'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-title text-ink">{copy.title}</h1>
              <span className="rounded-full bg-bg-alt px-2.5 py-1 text-xs font-medium text-ink-2">
                {copy.badge}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{copy.description}</p>
          </div>
        </div>

        {!isRejected && (
          <div className="mt-8 rounded-2xl border border-line bg-bg-card p-8 text-center">
            <span className="text-3xl">🎉</span>
            <h2 className="mt-3 text-heading text-ink">
              You&apos;re in the queue, <span className="text-accent">{application.firstName}.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-[440px] text-sm leading-relaxed text-ink-3">
              Your application has been submitted successfully. Our credentials committee will
              personally review your profile.
            </p>
          </div>
        )}

        <p className="mb-3.5 mt-8 text-mono-label text-ink-3">
          {isRejected ? 'DETAILS' : 'WHAT HAPPENS NEXT'}
        </p>

        {isRejected ? (
          <div className="rounded-2xl border border-line bg-bg-card p-6 text-sm text-ink-2">
            {application.status === 'rejected'
              ? 'Reach out to support if you have questions about this decision.'
              : null}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 max-[720px]:grid-cols-1">
            <NextStepCard num="01 · REVIEW" title="Credentials check">
              Our committee verifies your qualifications and peer references.
            </NextStepCard>
            <NextStepCard num="02 · DECISION" title="Email notification">
              You&apos;ll receive an email once the review is complete with next steps.
            </NextStepCard>
            <NextStepCard num="03 · ONBOARD" title="Profile goes live">
              If accepted, your verified profile is published in the expert directory.
            </NextStepCard>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3.5">
          <Link
            href="/"
            className="flex min-h-[48px] items-center rounded-input border border-line-2 px-6 text-sm font-medium text-ink hover:border-ink"
          >
            Back to Home
          </Link>
          {isRejected && (
            <Link
              href="/apply"
              className="flex min-h-[48px] items-center gap-2 rounded-input bg-ink px-6 text-sm font-medium text-bg hover:bg-ink-2"
            >
              Apply again <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

function NextStepCard({ num, title, children }: { num: string; title: string; children: string }) {
  return (
    <div className="rounded-2xl border border-line bg-bg-card p-5">
      <span className="text-mono-label text-accent">{num}</span>
      <h3 className="mt-2 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{children}</p>
    </div>
  );
}
