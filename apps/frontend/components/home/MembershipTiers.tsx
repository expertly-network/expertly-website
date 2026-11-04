import { Button, Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';

const STEPS = [
  ['Apply', 'Tell us what you have done, where you have done it, and the services you do best.'],
  [
    'Verify',
    'Identity, work history, qualifications and credentials, checked one by one. We speak to your references.',
  ],
  [
    'Approve',
    'If the details in your application are in order and every check comes back clear, your membership is approved.',
  ],
  ['Go live', 'Your verified profile joins the directory, with your tier shown beside your name.'],
] as const;

export function MembershipTiers() {
  return (
    <section className="border-b border-line bg-bg-alt py-24" aria-labelledby="how-to-join-title">
      <PageContainer>
        <Eyebrow>How to join</Eyebrow>
        <h2 id="how-to-join-title" className="font-brand mt-4 text-section-title text-ink">
          Membership is <span className="text-accent">earned</span>, not bought.
          <br />
          Here&apos;s how it works.
        </h2>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="rounded-card border border-line bg-bg-card p-6 sm:p-8">
              <span className="text-stat text-accent">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-5 text-title text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-3">{body}</p>
            </li>
          ))}
        </ol>
        <Button href="/membership" className="mt-10">
          See membership benefits →
        </Button>
      </PageContainer>
    </section>
  );
}
