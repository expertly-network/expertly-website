import { MemberBenefits } from '@/components/home/MemberBenefits';
import { UserBenefits } from '@/components/home/UserBenefits';
import { ProblemRing } from '@/components/home/ProblemRing';
import { USER_BENEFITS, VERTICALS } from '@/components/home/verticals-data';

// The problem (the ring, with the questions every practice is asking coming out of it), then what
// members get (the dial) and what users get (the stack).
export function Verticals() {
  return (
    <>
      <ProblemRing />

      <MemberBenefits benefits={VERTICALS} />
      <UserBenefits benefits={USER_BENEFITS} />
    </>
  );
}
