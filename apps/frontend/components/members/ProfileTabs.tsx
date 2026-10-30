'use client';

import { useUrlTab } from '@/lib/hooks/useUrlTab';
import { AboutTab } from '@/components/members/tabs/AboutTab';
import { CredentialsTab } from '@/components/members/tabs/CredentialsTab';
import { ArticlesTab } from '@/components/members/tabs/ArticlesTab';
import { ReviewsTab } from '@/components/members/tabs/ReviewsTab';
import { ContactTab } from '@/components/members/tabs/ContactTab';
import type { MemberDto, MemberEditSection, MemberProfileEditDto } from '@shared/member';

// `key` doubles as the ?tab= value (useUrlTab), so it's lowercase and URL-friendly.
const TABS = [
  { key: 'about', label: 'About' },
  { key: 'credentials', label: 'Credentials' },
  { key: 'articles', label: 'Articles' },
  { key: 'reviews', label: 'Reviews & Recognition' },
  { key: 'contact', label: 'Contact Information' },
] as const;
type Tab = (typeof TABS)[number]['key'];
const TAB_KEYS = TABS.map((t) => t.key);

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
  const [active, setActive] = useUrlTab<Tab>(TAB_KEYS, 'about');

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
      <div
        role="tabpanel"
        className="rounded-panel border border-line bg-bg-card p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] max-[640px]:p-5"
      >
        {active === 'about' && <AboutTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />}
        {active === 'credentials' && (
          <CredentialsTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'articles' && <ArticlesTab authorId={member.id} isOwnProfile={isOwnProfile} />}
        {active === 'reviews' && (
          <ReviewsTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'contact' && (
          <ContactTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
}
