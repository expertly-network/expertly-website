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
  [
    'Go live',
    'Your approved profile becomes visible in the member directory, where clients and peers can find you and see your experience tier: Budding or Seasoned Professional.',
  ],
] as const;

export function MembershipTiers() {
  return (
    <section className="border-b border-line bg-bg-alt py-10 sm:py-16" aria-labelledby="how-to-join-title">
      <PageContainer>
        <Eyebrow>How to join</Eyebrow>
        <h2 id="how-to-join-title" className="font-brand mt-4 text-section-title text-ink">
          Membership is <span className="text-accent">earned</span>, not bought.
          <br />
          Here&apos;s how it works.
        </h2>
        {/* Phones: a vertical timeline (numbered dots joined by a line). Larger: one card per step. */}
        <ol className="mt-6 grid sm:mt-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {STEPS.map(([title, body], i) => (
            <li
              key={title}
              className="relative grid grid-cols-[28px_1fr] gap-x-4 pb-6 after:absolute after:bottom-0 after:left-[13.5px] after:top-8 after:w-px after:bg-line-2 last:pb-0 last:after:hidden sm:block sm:rounded-card sm:border sm:border-line sm:bg-bg-card sm:p-6 sm:after:hidden"
            >
              <div className="contents sm:flex sm:items-center sm:gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-accent font-mono text-xs font-semibold text-bg-card sm:hidden"
                >
                  {i + 1}
                </span>
                <span className="hidden text-stat text-accent sm:inline">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="self-center text-title text-ink">{title}</h3>
              </div>
              <p className="col-start-2 mt-1 text-sm leading-relaxed text-ink-3 sm:mt-4">{body}</p>
            </li>
          ))}
        </ol>
        <Button href="/membership" className="mt-7 sm:mt-8">
          See membership benefits →
        </Button>
      </PageContainer>
    </section>
  );
}
