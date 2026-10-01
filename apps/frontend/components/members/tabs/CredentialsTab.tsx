import { ProfileSectionEmpty, ProfileSectionHeader, SECTION_ICONS } from '@/components/members/ProfileSection';
import { formatWorkPeriod } from '@/lib/members/format';
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
  const edit = (section: 'education' | 'work_experiences') =>
    isOwnProfile ? () => onEdit(section) : undefined;

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
              <div key={edu.id} className="rounded-panel border border-line bg-bg-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
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
          // `.mp-timeline` — vertical rule with an accent dot per role, each role in its own card.
          <ol className="ml-[5px] border-l-2 border-line pl-4">
            {member.workExperiences.map((work) => {
              const { range, duration } = formatWorkPeriod(work.startYear, work.endYear, work.isCurrent);
              return (
                <li key={work.id} className="relative mb-5 last:mb-0">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[22px] top-[18px] h-2.5 w-2.5 rounded-full border-2 border-bg-card bg-accent shadow-[0_0_0_1px_var(--line)]"
                  />
                  <div className="rounded-panel border border-line bg-bg-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                    <div className="flex items-start justify-between gap-2 max-[480px]:flex-col max-[480px]:gap-1">
                      <div className="min-w-0">
                        <div className="text-profile-item font-semibold text-ink">{work.title}</div>
                        <div className="mt-0.5 text-profile-meta text-ink-3">{work.company}</div>
                      </div>
                      <div className="flex-none whitespace-nowrap text-profile-meta text-ink-3">
                        {range}
                        {duration && <span className="text-ink-4"> · {duration}</span>}
                      </div>
                    </div>
                    {work.description ? (
                      <p className="mt-2 line-clamp-2 text-caption leading-relaxed text-ink-3" title={work.description}>
                        {work.description}
                      </p>
                    ) : (
                      isOwnProfile && (
                        <button
                          type="button"
                          onClick={() => onEdit('work_experiences')}
                          className="mt-2 inline-flex items-center gap-1 text-caption font-medium text-accent hover:underline"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          Add a description
                        </button>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
