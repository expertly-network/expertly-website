'use client';

import { Button } from '@/components/ui';
import { formatRate } from '@/lib/members/format';
import type { MemberDto } from '@shared/member';

export function MobileCtaBar({
  member,
  isOwnProfile,
  onRequestConsultation,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
  onRequestConsultation: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-line bg-bg-card px-4 py-3 min-[1024px]:hidden">
      <div>
        <div className="text-sm font-semibold text-ink">
          {formatRate(member.rateMinCents, member.rateMaxCents, member.rateCurrency)}
        </div>
        <div className="text-xs text-ink-3">
          {member.isAvailable ? 'Available' : 'Currently unavailable'}
        </div>
      </div>
      {!isOwnProfile && <Button onClick={onRequestConsultation}>Request Consultation</Button>}
    </div>
  );
}
