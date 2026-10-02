'use client';

import { useState } from 'react';
import { ReceivedConsultationsList } from '@/components/consultations/ReceivedConsultationsList';
import { MyConsultationsList } from '@/components/consultations/MyConsultationsList';
import type { ConsultationRequestDto } from '@shared/consultation-request';

const TABS = [
  { key: 'received', label: 'Received' },
  { key: 'mine', label: 'My Requests' },
] as const;
type Tab = (typeof TABS)[number]['key'];

// Members both receive requests (as the expert) and can send them (to other members), so they
// get both tabs. A client/admin only ever sends requests, so the "Received" tab never applies.
export function ConsultationsTabs({
  isMember,
  received,
  mine,
  viewerId,
}: {
  isMember: boolean;
  received: ConsultationRequestDto[];
  mine: ConsultationRequestDto[];
  viewerId: string;
}) {
  const [active, setActive] = useState<Tab>('received');

  if (!isMember) {
    return <MyConsultationsList initialRequests={mine} viewerId={viewerId} />;
  }

  return (
    <div>
      <div role="tablist" className="mb-6 flex gap-2 border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={`-mb-px border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              active === tab.key ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {active === 'received' ? (
          <ReceivedConsultationsList initialRequests={received} viewerId={viewerId} />
        ) : (
          <MyConsultationsList initialRequests={mine} viewerId={viewerId} />
        )}
      </div>
    </div>
  );
}
