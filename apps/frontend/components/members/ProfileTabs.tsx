'use client';

import { useEffect, useRef } from 'react';
import { useUrlTab } from '@/lib/hooks/useUrlTab';
import { STICKY_UNDER_MOBILE_BAR } from '@/lib/ui/mobile';
import { AboutTab } from '@/components/members/tabs/AboutTab';
import { CredentialsTab } from '@/components/members/tabs/CredentialsTab';
import { ArticlesTab } from '@/components/members/tabs/ArticlesTab';
import { ReviewsTab } from '@/components/members/tabs/ReviewsTab';
import { ContactTab } from '@/components/members/tabs/ContactTab';
import type { MemberDto, MemberEditSection, MemberProfileEditDto } from '@shared/member';

// `key` doubles as the ?tab= value (useUrlTab), so it's lowercase and URL-friendly. `short` is the
// phone label, so more of the tab row fits before it has to scroll.
const TABS = [
  { key: 'about', label: 'About', short: 'About' },
  { key: 'credentials', label: 'Credentials', short: 'Credentials' },
  { key: 'articles', label: 'Articles', short: 'Articles' },
  { key: 'reviews', label: 'Reviews & Recognition', short: 'Reviews' },
  { key: 'contact', label: 'Contact Information', short: 'Contact' },
] as const;
type Tab = (typeof TABS)[number]['key'];
const TAB_KEYS = TABS.map((t) => t.key);

export function ProfileTabs({
  member,
  edits,
  isOwnProfile,
  onEdit,
  onRequestConsultation,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: MemberEditSection) => void;
  onRequestConsultation?: () => void;
}) {
  const [active, setActive] = useUrlTab<Tab>(TAB_KEYS, 'about');
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  // Keep the active tab in view when the row scrolls (phones), e.g. arriving on ?tab=contact.
  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return (
    <div>
      {/* `.mp-tabs-nav` / `.mp-tab` — underline tabs, not pills. Phones: a full-width bar that sticks
          under the 62px mobile top bar while the long tab content scrolls. */}
      <div
        className={`sticky ${STICKY_UNDER_MOBILE_BAR} z-10 -mx-5 mb-4 overflow-hidden border-y border-line bg-bg-card sm:static sm:mx-0 sm:rounded-panel sm:border sm:shadow-panel`}
      >
        <div role="tablist" className="flex overflow-x-auto px-2 sm:px-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[tab.key] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active === tab.key}
              onClick={() => setActive(tab.key)}
              className={`flex-none whitespace-nowrap border-b-2 px-3 py-3.5 font-mono sm:px-5 text-profile-item font-medium transition-colors ${
                active === tab.key ? 'border-ink-2 text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'
              }`}
            >
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* `.mp-tab-content` — phones drop the panel frame so the content (itself made of cards) gets
          the full width instead of nesting a card inside a card. */}
      <div role="tabpanel" className="sm:rounded-panel sm:border sm:border-line sm:bg-bg-card sm:p-6 sm:shadow-panel">
        {active === 'about' && <AboutTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />}
        {active === 'credentials' && (
          <CredentialsTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'articles' && <ArticlesTab authorId={member.id} isOwnProfile={isOwnProfile} />}
        {active === 'reviews' && (
          <ReviewsTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'contact' && (
          <ContactTab
            member={member}
            edits={edits}
            isOwnProfile={isOwnProfile}
            onEdit={onEdit}
            onRequestConsultation={onRequestConsultation}
          />
        )}
      </div>
    </div>
  );
}
