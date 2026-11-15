import { ProfileSectionEmpty, ProfileSectionHeader, SECTION_ICONS } from '@/components/members/ProfileSection';
import { VerificationBadge } from '@/components/members/VerificationBadge';
import { AddProofPrompt } from '@/components/members/AddProofPrompt';
import { KeyClientsRows } from '@/components/members/KeyClientsRows';
import { FormattedText } from '@/components/shared/FormattedText';
import { ExternalLink } from '@/components/shared/ExternalLink';
import type { EditTarget } from '@/components/members/edit/SectionEditModal';
import type { MemberDto } from '@shared/member';

export function AboutTab({
  member,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
  onEdit: (target: EditTarget) => void;
}) {
  // The headline is the line under the member's name, not part of About — About is the bio alone.
  const hasBio = Boolean(member.bio);
  const hasClients = member.keyClients.length > 0;
  const editBio = isOwnProfile ? () => onEdit({ section: 'headline_bio' }) : undefined;
  const editClients = isOwnProfile ? () => onEdit({ section: 'key_clients' }) : undefined;
  const editEngagements = isOwnProfile ? () => onEdit({ section: 'engagements' }) : undefined;

  return (
    <div className="flex flex-col gap-7">
      {(hasBio || isOwnProfile) && (
        <section>
          {/* The tab above already says "About", so the paragraph starts straight away. */}
          <ProfileSectionHeader label="About" hideLabel onEdit={editBio} />
          {member.bio && <FormattedText text={member.bio} className="text-profile-body text-ink-3" />}
          {!hasBio && <ProfileSectionEmpty title="No bio yet." hint="Tell clients who you are" onEdit={editBio} />}
        </section>
      )}

      <section>
        <ProfileSectionHeader label="Key Engagements" icon={SECTION_ICONS.engagements} onEdit={editEngagements} />
        {member.engagements.length === 0 ? (
          isOwnProfile ? (
            <ProfileSectionEmpty
              title="No key engagements yet."
              hint="Showcase your most impactful work"
              onEdit={editEngagements}
            />
          ) : (
            <p className="text-profile-item text-ink-3">No engagements listed yet.</p>
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {member.engagements.map((eng) => (
              // `.mp-engagement` — light-gray row (var(--line)) on the white tab card.
              <li key={eng.id} className="rounded-panel border border-line bg-bg-alt px-4 py-3">
                <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1.5">
                  <span className="min-w-0 flex-1 text-profile-item font-medium text-ink">
                    {[eng.title, eng.clientName, eng.year].filter(Boolean).join(' · ')}
                  </span>
                  <ExternalLink
                    url={eng.url}
                    aria-label={`Open link for ${eng.title}`}
                    className="mt-0.5 flex-none text-profile-meta text-ink-2 hover:underline"
                  >
                    ↗
                  </ExternalLink>
                  <VerificationBadge verified={eng.isVerified} />
                </div>
                <AddProofPrompt
                  isOwnProfile={isOwnProfile}
                  verified={eng.isVerified}
                  hasProof={(eng.proofAttachments?.length ?? 0) > 0}
                  onAddProof={() => onEdit({ section: 'engagements', itemId: eng.id })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {(hasClients || isOwnProfile) && (
        <section>
          <ProfileSectionHeader label="Key Clients" icon={SECTION_ICONS.clients} onEdit={editClients} />
          {!hasClients ? (
            <ProfileSectionEmpty
              title="No key clients yet."
              hint="Showcase who you've worked with"
              onEdit={editClients}
            />
          ) : (
            <KeyClientsRows clients={member.keyClients} />
          )}
        </section>
      )}
    </div>
  );
}
