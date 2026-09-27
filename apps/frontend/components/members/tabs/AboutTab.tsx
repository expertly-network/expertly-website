import { SectionBadge } from '@/components/members/SectionBadge';
import { getSectionEditBadge } from '@/lib/members/edit-badge';
import type { MemberDto, MemberProfileEditDto } from '@shared/member';

// Cycled by index, same palette design/static_html/member-profile.html uses for a Key Client's
// fallback initial-letter icon when it has no logoUrl.
const CLIENT_ICON_COLORS = [
  '#0A66C2', '#F97316', '#16A34A', '#7C3AED', '#DC2626', '#0891B2', '#B45309', '#1D4ED8', '#9333EA', '#059669',
];

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
  // Rendered twice back to back so the marquee's translateX(-50%) loops seamlessly.
  const clientCards = member.keyClients.length > 0 ? [...member.keyClients, ...member.keyClients] : [];

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">About</h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('headline_bio', edits, member.isVerified)} />
            {isOwnProfile && <EditButton onClick={() => onEdit('headline_bio')} />}
          </div>
        </div>
        {member.headline && <p className="mt-2 font-medium text-ink">{member.headline}</p>}
        {member.bio && <p className="mt-2 whitespace-pre-line text-sm text-ink-3">{member.bio}</p>}
        {!member.headline && !member.bio && <p className="mt-2 text-sm text-ink-3">No bio yet.</p>}
      </section>

      <section className="border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-title text-ink">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-none">
              <path d="M8 1L10 6h5l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5L8 1z" fill="var(--accent)" />
            </svg>
            Key Engagements
          </h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('engagements', edits, member.isVerified)} />
            {isOwnProfile && <EditButton onClick={() => onEdit('engagements')} />}
          </div>
        </div>
        {member.engagements.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No engagements listed yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {member.engagements.map((eng) => (
              <li key={eng.id} className="flex items-start gap-3 rounded-2xl bg-line px-4 py-3">
                <span className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full bg-black/[0.06]">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l4 4 6-7" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-[14.5px] font-medium leading-[1.45] text-ink">
                  {[eng.title, eng.organization, eng.year].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-title text-ink">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-none">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" stroke="var(--accent)" strokeWidth="1.6" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Key Clients
          </h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('key_clients', edits, member.isVerified)} />
            {isOwnProfile && <EditButton onClick={() => onEdit('key_clients')} />}
          </div>
        </div>
        {member.keyClients.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No key clients listed yet.</p>
        ) : (
          <div
            className="relative mt-3 overflow-hidden"
            style={{ maskImage: 'linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%)' }}
          >
            <div className="flex w-max animate-marquee gap-2.5 hover:[animation-play-state:paused]">
              {clientCards.map((client, i) => (
                <div
                  key={`${client.id}-${i}`}
                  className="flex min-w-[160px] flex-none items-center gap-3 rounded-2xl border border-[#e4ede9] bg-bg-card py-2.5 pl-2.5 pr-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  {client.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={client.logoUrl} alt={client.name} className="h-11 w-11 flex-none rounded-[11px] object-cover" />
                  ) : (
                    <span
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-[11px] text-lg font-extrabold text-bg-card"
                      style={{ background: CLIENT_ICON_COLORS[i % CLIENT_ICON_COLORS.length] }}
                    >
                      {client.name.charAt(0)}
                    </span>
                  )}
                  <span className="whitespace-nowrap text-[15px] font-semibold leading-[1.25] text-ink">
                    {client.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
