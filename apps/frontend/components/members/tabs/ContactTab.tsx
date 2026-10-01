import type { ReactNode } from 'react';
import { ProfileSectionEmpty, ProfileSectionHeader } from '@/components/members/ProfileSection';
import { getSectionEditBadge, getSectionRejectionNote } from '@/lib/members/edit-badge';
import { displayHost } from '@/lib/members/format';
import type { MemberDto, MemberProfileEditDto } from '@shared/member';

interface ContactItem {
  label: string;
  value: string;
  href: string;
  external: boolean;
  icon: ReactNode;
}

const ICONS = {
  email: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="var(--accent)" strokeWidth="1.6" />
      <path d="M2 8l10 7 10-7" stroke="var(--accent)" strokeWidth="1.6" />
    </svg>
  ),
  phone: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" stroke="var(--accent)" strokeWidth="1.6" />
    </svg>
  ),
  linkedin: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden="true">
      <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.2V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
    </svg>
  ),
  website: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="var(--accent)" strokeWidth="1.6" />
      <path d="M2 12h20M12 2c-3 2-5 5.4-5 10s2 8 5 10M12 2c3 2 5 5.4 5 10s-2 8-5 10" stroke="var(--accent)" strokeWidth="1.4" />
    </svg>
  ),
  company: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function ContactTab({
  member,
  edits,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: 'contact') => void;
}) {
  const items: ContactItem[] = [];
  if (member.contactEmail) {
    items.push({ label: 'Email', value: member.contactEmail, href: `mailto:${member.contactEmail}`, external: false, icon: ICONS.email });
  }
  if (member.contactPhone) {
    items.push({ label: 'Phone', value: member.contactPhone, href: `tel:${member.contactPhone.replace(/\s/g, '')}`, external: false, icon: ICONS.phone });
  }
  if (member.linkedinUrl) {
    items.push({ label: 'LinkedIn', value: 'View Profile', href: member.linkedinUrl, external: true, icon: ICONS.linkedin });
  }
  if (member.website) {
    items.push({ label: 'Website', value: displayHost(member.website), href: member.website, external: true, icon: ICONS.website });
  }
  // Firm website comes from the member's firm record, not the contact section — so it's shown
  // here read-only, labelled with the firm's name when there is one.
  if (member.firmWebsite) {
    const firm = member.firmName && member.firmName !== 'Independent' ? member.firmName : null;
    items.push({
      label: firm ? `Company · ${firm}` : 'Company website',
      value: displayHost(member.firmWebsite),
      href: member.firmWebsite,
      external: true,
      icon: ICONS.company,
    });
  }

  return (
    <section>
      <ProfileSectionHeader
        label="Contact Information"
        badge={getSectionEditBadge('contact', edits, member.isVerified)}
        onEdit={isOwnProfile ? () => onEdit('contact') : undefined}
        rejectionNote={getSectionRejectionNote('contact', edits)}
      />
      {items.length === 0 ? (
        isOwnProfile ? (
          <ProfileSectionEmpty
            title="No contact details yet."
            hint="Let clients reach you"
            onEdit={() => onEdit('contact')}
          />
        ) : (
          <p className="text-profile-item text-ink-3">No contact details listed yet.</p>
        )
      ) : (
        // `.mp-contact-grid` / `.mp-contact-card`
        <div className="grid grid-cols-2 gap-3 max-[639px]:grid-cols-1">
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="flex min-w-0 items-center gap-3 rounded-panel border border-line bg-bg-card p-3.5 transition-colors hover:border-[color-mix(in_oklab,var(--accent)_40%,transparent)] hover:bg-[color-mix(in_oklab,var(--accent)_5%,transparent)]"
            >
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-input bg-black/[0.06]">
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-mono text-[10px] font-semibold tracking-[0.08em] text-ink-3">
                  {item.label}
                </span>
                <span className="block truncate text-profile-item font-semibold text-ink" title={item.value}>
                  {item.value}
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
