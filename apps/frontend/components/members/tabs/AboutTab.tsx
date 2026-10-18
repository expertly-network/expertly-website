import { ProfileSectionEmpty, ProfileSectionHeader, SECTION_ICONS } from '@/components/members/ProfileSection';
import { getSectionEditBadge, getSectionRejectionNote } from '@/lib/members/edit-badge';
import { KeyClientsRows } from '@/components/members/KeyClientsRows';
import type { MemberDto, MemberProfileEditDto } from '@shared/member';

export function AboutTab({
  member,
  edits,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: 'headline_bio' | 'engagements' | 'key_clients') => void;
}) {
  const edit = (section: 'headline_bio' | 'engagements' | 'key_clients') =>
    isOwnProfile ? () => onEdit(section) : undefined;
  const hasBio = Boolean(member.headline || member.bio);
  const hasClients = member.keyClients.length > 0;

  return (
    <div className="flex flex-col gap-7">
      {(hasBio || isOwnProfile) && (
        <section>
          <ProfileSectionHeader
            label="About"
            badge={getSectionEditBadge('headline_bio', edits, member.isVerified)}
            onEdit={edit('headline_bio')}
            rejectionNote={getSectionRejectionNote('headline_bio', edits)}
          />
          {member.headline && (
            <p className="mb-3 text-base font-semibold leading-normal text-ink">{member.headline}</p>
          )}
          {member.bio && <p className="whitespace-pre-line text-profile-body text-ink-3">{member.bio}</p>}
          {!hasBio && (
            <ProfileSectionEmpty
              title="No bio yet."
              hint="Tell clients who you are"
              onEdit={edit('headline_bio')}
            />
          )}
        </section>
      )}

      <section>
        <ProfileSectionHeader
          label="Key Engagements"
          icon={SECTION_ICONS.engagements}
          badge={getSectionEditBadge('engagements', edits, member.isVerified)}
          onEdit={edit('engagements')}
          rejectionNote={getSectionRejectionNote('engagements', edits)}
        />
        {member.engagements.length === 0 ? (
          isOwnProfile ? (
            <ProfileSectionEmpty
              title="No key engagements yet."
              hint="Showcase your most impactful work"
              onEdit={edit('engagements')}
            />
          ) : (
            <p className="text-profile-item text-ink-3">No engagements listed yet.</p>
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {member.engagements.map((eng) => (
              // `.mp-engagement` — light-gray row (var(--line)) on the white tab card.
              <li
                key={eng.id}
                className="flex items-start gap-3 rounded-panel border border-line bg-line px-4 py-3"
              >
                <span className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full bg-black/[0.06]">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8l4 4 6-7" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1 text-profile-item font-medium text-ink">
                  {[eng.title, eng.organization, eng.year].filter(Boolean).join(' · ')}
                </span>
                {eng.url && (
                  <a
                    href={eng.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open link for ${eng.title}`}
                    className="mt-0.5 flex-none text-profile-meta text-ink-2 hover:underline"
                  >
                    ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(hasClients || isOwnProfile) && (
        <section>
          <ProfileSectionHeader
            label="Key Clients"
            icon={SECTION_ICONS.clients}
            badge={getSectionEditBadge('key_clients', edits, member.isVerified)}
            onEdit={edit('key_clients')}
            rejectionNote={getSectionRejectionNote('key_clients', edits)}
          />
          {!hasClients ? (
            <ProfileSectionEmpty
              title="No key clients yet."
              hint="Showcase who you've worked with"
              onEdit={edit('key_clients')}
            />
          ) : (
            <KeyClientsRows clients={member.keyClients} />
          )}
        </section>
      )}
    </div>
  );
}
