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
      <div className="flex gap-1 overflow-x-auto rounded-card border border-line bg-bg-card p-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`whitespace-nowrap rounded-input px-4 py-2.5 text-sm font-medium transition-colors ${
              active === tab.key ? 'bg-ink text-bg' : 'text-ink-3 hover:bg-bg-alt hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-card border border-line bg-bg-card p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        {active === 'About' && (
          <AboutTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'Credentials' && (
          <CredentialsTab member={member} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'Articles' && <ArticlesTab authorId={member.id} />}
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
