import { SectionBadge } from '@/components/members/SectionBadge';
import { getSectionEditBadge } from '@/lib/members/edit-badge';
import type { MemberDto, MemberProfileEditDto } from '@shared/member';

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-medium text-accent">
      Edit
    </button>
  );
}

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
  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Headline &amp; Bio</h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('headline_bio', edits)} />
            {isOwnProfile && <EditButton onClick={() => onEdit('headline_bio')} />}
          </div>
        </div>
        {member.headline && <p className="mt-2 font-medium text-ink">{member.headline}</p>}
        {member.bio && <p className="mt-2 whitespace-pre-line text-sm text-ink-3">{member.bio}</p>}
        {!member.headline && !member.bio && <p className="mt-2 text-sm text-ink-3">No bio yet.</p>}
      </section>

      <section className="border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Key Engagements</h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('engagements', edits)} />
            {isOwnProfile && <EditButton onClick={() => onEdit('engagements')} />}
          </div>
        </div>
        {member.engagements.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No engagements listed yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {member.engagements.map((eng) => (
              <li key={eng.id} className="rounded-xl border border-line p-4">
                <div className="font-medium text-ink">{eng.title}</div>
                <div className="text-sm text-ink-3">
                  {eng.organization}
                  {eng.year ? ` · ${eng.year}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Key Clients</h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('key_clients', edits)} />
            {isOwnProfile && <EditButton onClick={() => onEdit('key_clients')} />}
          </div>
        </div>
        {member.keyClients.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No key clients listed yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-4 max-[640px]:grid-cols-2">
            {member.keyClients.map((client) => (
              <div
                key={client.id}
                className="flex h-16 items-center justify-center rounded-xl border border-line px-3"
              >
                {client.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={client.logoUrl} alt={client.name} className="max-h-8 max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-ink-3">{client.name}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
