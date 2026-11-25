import { MemberBenefits } from '@/components/home/MemberBenefits';
import { UserBenefits } from '@/components/home/UserBenefits';
import { ProblemRing } from '@/components/home/ProblemRing';
import { USER_BENEFITS, VERTICALS } from '@/components/home/verticals-data';
import { PageContainer } from '@/components/layout/PageContainer';

// The problem (the ring, with the questions every practice is asking coming out of it), a line that
// hands over to the answer, what members get (the dial), what users get (the stack).
export function Verticals() {
  return (
    <>
      <ProblemRing />

      <PageContainer className="flex flex-col items-center gap-2 pb-12 text-center sm:pb-20">
        <p className="font-brand text-title text-ink sm:text-2xl">GrowXQ is built to answer them.</p>
        <a
          href="#layers-title"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-label font-medium text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          See how
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-4"
          >
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        </a>
      </PageContainer>

      <MemberBenefits benefits={VERTICALS} />
      <UserBenefits benefits={USER_BENEFITS} />
    </>
  );
}
