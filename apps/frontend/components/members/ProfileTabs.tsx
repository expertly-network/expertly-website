'use client';

import { useState } from 'react';
import { AboutTab } from '@/components/members/tabs/AboutTab';
import { CredentialsTab } from '@/components/members/tabs/CredentialsTab';
import { ArticlesTab } from '@/components/members/tabs/ArticlesTab';
import { ReviewsTab } from '@/components/members/tabs/ReviewsTab';
import { ContactTab } from '@/components/members/tabs/ContactTab';
import type { MemberDto, MemberEditSection, MemberProfileEditDto } from '@shared/member';

const TABS = [
  { key: 'About', label: 'About' },
  { key: 'Credentials', label: 'Credentials' },
  { key: 'Articles', label: 'Articles' },
  { key: 'Reviews', label: 'Reviews & Recognition' },
  { key: 'Contact', label: 'Contact Information' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export function ProfileTabs({
  member,
  edits,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: MemberEditSection) => void;
}) {
  const [active, setActive] = useState<Tab>('About');

  return (
    <div>
      {/* `.mp-tabs-nav` / `.mp-tab` — underline tabs, not pills. */}
      <div className="mb-4 overflow-hidden rounded-panel border border-line bg-bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <div role="tablist" className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active === tab.key}
              onClick={() => setActive(tab.key)}
              className={`flex-none whitespace-nowrap border-b-2 px-5 py-3.5 font-mono text-profile-item font-medium transition-colors ${
                active === tab.key ? 'border-ink-2 text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* `.mp-tab-content` */}
      <div role="tabpanel" className="rounded-panel border border-line bg-bg-card p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] max-[640px]:p-5">
        {active === 'About' && (
          <AboutTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'Credentials' && (
          <CredentialsTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'Articles' && (
          <ArticlesTab authorId={member.id} isOwnProfile={isOwnProfile} />
        )}
        {active === 'Reviews' && (
          <ReviewsTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'Contact' && (
          <ContactTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
}
