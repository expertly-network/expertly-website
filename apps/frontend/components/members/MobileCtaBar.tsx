'use client';

import { Button } from '@/components/ui';
import { formatRate } from '@/lib/members/format';
import type { MemberDto } from '@shared/member';

// Pure viewport-width trigger (min-[1024px]:hidden), always shown below
// 1024px regardless of any other state — matches the prototype's own
// unconditional CSS-only behavior exactly (see design spec §6).
export function MobileCtaBar({ member }: { member: MemberDto }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-line bg-bg-card px-4 py-3 min-[1024px]:hidden">
      <div>
        <div className="text-sm font-semibold text-ink">
          {formatRate(member.rateMinCents, member.rateMaxCents, member.rateCurrency)}
        </div>
        <div className="text-xs text-ink-3">
          {member.isAvailable ? 'Available' : 'Not currently available'}
        </div>
      </div>
      <Button disabled aria-disabled="true" title="Coming soon">
        Request Consultation
      </Button>
    </div>
  );
}
