import type { MemberDto } from '@shared/member';

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-medium text-accent">
      Edit
    </button>
  );
}

export function CredentialsTab({
  member,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
  onEdit: (section: 'education' | 'work_experiences') => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Education</h2>
          {isOwnProfile && <EditButton onClick={() => onEdit('education')} />}
        </div>
        {member.educations.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No education listed yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            {member.educations.map((edu) => (
              <div key={edu.id} className="rounded-xl border border-line p-4">
                <div className="font-medium text-ink">{edu.degree}</div>
                <div className="text-sm text-ink-3">
                  {edu.institution}
                  {edu.endYear ? ` · ${edu.endYear}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Work Experience</h2>
          {isOwnProfile && <EditButton onClick={() => onEdit('work_experiences')} />}
        </div>
        {member.workExperiences.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No work experience listed yet.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-4 border-l border-line pl-5">
            {member.workExperiences.map((work) => (
              <li key={work.id}>
                <div className="font-medium text-ink">{work.title}</div>
                <div className="text-sm text-ink-3">
                  {work.company} · {work.startYear}–{work.isCurrent ? 'Present' : work.endYear}
                </div>
                {work.description && <p className="mt-1 text-sm text-ink-3">{work.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
