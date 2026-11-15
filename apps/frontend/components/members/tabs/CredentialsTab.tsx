'use client';

import { GRADUATION_ICON, HighlightedEntry } from '@/components/members/HighlightedEntry';
import { ProfileSectionEmpty, ProfileSectionHeader, SECTION_ICONS } from '@/components/members/ProfileSection';
import { VerificationBadge } from '@/components/members/VerificationBadge';
import { AddProofPrompt } from '@/components/members/AddProofPrompt';
import { WorkHistoryTimeline } from '@/components/members/WorkHistoryTimeline';
import type { EditTarget } from '@/components/members/edit/SectionEditModal';
import type { MemberDto } from '@shared/member';

export function CredentialsTab({
  member,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
  onEdit: (target: EditTarget) => void;
}) {
  const editWork = isOwnProfile ? () => onEdit({ section: 'work_experiences' }) : undefined;
  const editEducation = isOwnProfile ? () => onEdit({ section: 'education' }) : undefined;

  return (
    <div className="flex flex-col gap-7">
      <section>
        <ProfileSectionHeader label="Work Experience" icon={SECTION_ICONS.work} onEdit={editWork} />
        {member.workExperiences.length === 0 ? (
          isOwnProfile ? (
            <ProfileSectionEmpty
              title="No work experience yet."
              hint="Add the roles that shaped your expertise"
              onEdit={editWork}
            />
          ) : (
            <p className="text-profile-item text-ink-3">No work experience listed yet.</p>
          )
        ) : (
          <WorkHistoryTimeline
            works={member.workExperiences}
            onAddDescription={
              isOwnProfile ? (role) => onEdit({ section: 'work_experiences', itemId: role.id }) : undefined
            }
            companyBadge={(roles) => <VerificationBadge verified={roles.every((r) => r.isVerified)} />}
            companyFooter={(roles) => (
              <AddProofPrompt
                isOwnProfile={isOwnProfile}
                verified={roles.every((r) => r.isVerified)}
                hasProof={roles.some((r) => (r.proofAttachments?.length ?? 0) > 0)}
                onAddProof={() => onEdit({ section: 'work_experiences' })}
              />
            )}
          />
        )}
      </section>

      <section>
        <ProfileSectionHeader label="Education" icon={SECTION_ICONS.education} onEdit={editEducation} />
        {member.educations.length === 0 ? (
          isOwnProfile ? (
            <ProfileSectionEmpty title="No education yet." hint="Add your degrees" onEdit={editEducation} />
          ) : (
            <p className="text-profile-item text-ink-3">No education listed yet.</p>
          )
        ) : (
          <ul className="flex flex-col gap-5">
            {member.educations.map((edu) => (
              <HighlightedEntry
                key={edu.id}
                year={edu.endYear}
                icon={GRADUATION_ICON}
                title={edu.field ? `${edu.degree}, ${edu.field}` : edu.degree}
                subtitle={edu.institution}
                actions={<VerificationBadge verified={edu.isVerified} />}
                footer={
                  <AddProofPrompt
                    isOwnProfile={isOwnProfile}
                    verified={edu.isVerified}
                    hasProof={(edu.proofAttachments?.length ?? 0) > 0}
                    onAddProof={() => onEdit({ section: 'education', itemId: edu.id })}
                  />
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
