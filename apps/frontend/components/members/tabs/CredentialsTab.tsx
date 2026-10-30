import { ProfileSectionEmpty, ProfileSectionHeader, SECTION_ICONS } from '@/components/members/ProfileSection';
import { WorkHistoryTimeline } from '@/components/members/WorkHistoryTimeline';
import { getSectionEditBadge, getSectionRejectionNote } from '@/lib/members/edit-badge';
import type { MemberDto, MemberProfileEditDto } from '@shared/member';

export function CredentialsTab({
  member,
  edits,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: 'education' | 'work_experiences') => void;
}) {
  const edit = (section: 'education' | 'work_experiences') => (isOwnProfile ? () => onEdit(section) : undefined);

  return (
    <div className="flex flex-col gap-7">
      <section>
        <ProfileSectionHeader
          label="Education"
          icon={SECTION_ICONS.education}
          badge={getSectionEditBadge('education', edits, member.isVerified)}
          onEdit={edit('education')}
          rejectionNote={getSectionRejectionNote('education', edits)}
        />
        {member.educations.length === 0 ? (
          isOwnProfile ? (
            <ProfileSectionEmpty title="No education yet." hint="Add your degrees" onEdit={edit('education')} />
          ) : (
            <p className="text-profile-item text-ink-3">No education listed yet.</p>
          )
        ) : (
          // `.mp-edu-grid` / `.mp-edu-card`
          <div className="grid grid-cols-2 gap-3 max-[639px]:grid-cols-1">
            {member.educations.map((edu) => (
              <div
                key={edu.id}
                className="rounded-panel border border-line bg-bg-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              >
                <div className="text-profile-item font-semibold text-ink">{edu.degree}</div>
                <div className="mt-[3px] text-profile-meta text-ink-3">
                  {edu.institution}
                  {edu.endYear ? ` · ${edu.endYear}` : ''}
                </div>
                {edu.field && <div className="text-profile-meta text-ink-3">{edu.field}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <ProfileSectionHeader
          label="Work Experience"
          icon={SECTION_ICONS.work}
          badge={getSectionEditBadge('work_experiences', edits, member.isVerified)}
          onEdit={edit('work_experiences')}
          rejectionNote={getSectionRejectionNote('work_experiences', edits)}
        />
        {member.workExperiences.length === 0 ? (
          isOwnProfile ? (
            <ProfileSectionEmpty
              title="No work experience yet."
              hint="Add the roles that shaped your expertise"
              onEdit={edit('work_experiences')}
            />
          ) : (
            <p className="text-profile-item text-ink-3">No work experience listed yet.</p>
          )
        ) : (
          <WorkHistoryTimeline
            works={member.workExperiences}
            onAddDescription={isOwnProfile ? () => onEdit('work_experiences') : undefined}
          />
        )}
      </section>
    </div>
  );
}
