import { ProfileSectionEmpty, ProfileSectionHeader, SECTION_ICONS } from '@/components/members/ProfileSection';
import { getSectionEditBadge, getSectionRejectionNote } from '@/lib/members/edit-badge';
import type { MemberDto, MemberKeyClient, MemberProfileEditDto } from '@shared/member';

// Cycled by index, same palette design/static_html/member-profile.html uses for a Key Client's
// fallback initial-letter icon when it has no logoUrl.
const CLIENT_ICON_COLORS = [
  '#0A66C2', '#F97316', '#16A34A', '#7C3AED', '#DC2626', '#0891B2', '#B45309', '#1D4ED8', '#9333EA', '#059669',
];

// Enough cards per half-strip to overflow the widest content column, so a member with only 1–3
// clients still gets a continuous marquee instead of a short row that visibly jumps back.
const MIN_CARDS_PER_LOOP = 8;

function marqueeCards(clients: MemberKeyClient[]): { client: MemberKeyClient; colorIndex: number }[] {
  const indexed = clients.map((client, colorIndex) => ({ client, colorIndex }));
  let half = indexed;
  while (half.length < MIN_CARDS_PER_LOOP) half = [...half, ...indexed];
  // Rendered twice back to back so the marquee's translateX(-50%) loops seamlessly.
  return [...half, ...half];
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
            // `.mp-clients-outer` / `.mp-clients-grid` — auto-scrolling marquee, pauses on hover.
            <div
              className="group relative overflow-hidden"
              style={{
                maskImage: 'linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%)',
              }}
            >
              <ul
                aria-label="Key clients"
                className="flex w-max animate-marquee gap-2.5 group-hover:[animation-play-state:paused] motion-reduce:animate-none"
              >
                {marqueeCards(member.keyClients).map(({ client, colorIndex }, i) => (
                  <li
                    key={`${client.id}-${i}`}
                    // Only the first copy of each client is announced to screen readers.
                    aria-hidden={i >= member.keyClients.length ? true : undefined}
                    className="flex min-w-[160px] flex-none items-center gap-3 rounded-panel border border-[#e4ede9] bg-bg-card py-2.5 pl-2.5 pr-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:border-line-2 hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]"
                  >
                    {client.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={client.logoUrl} alt="" className="h-11 w-11 flex-none rounded-[11px] object-cover" />
                    ) : (
                      <span
                        className="flex h-11 w-11 flex-none items-center justify-center rounded-[11px] font-mono text-lg font-extrabold text-bg-card"
                        style={{ background: CLIENT_ICON_COLORS[colorIndex % CLIENT_ICON_COLORS.length] }}
                      >
                        {client.name.charAt(0)}
                      </span>
                    )}
                    <span className="whitespace-nowrap text-[15px] font-semibold leading-[1.25] text-ink">
                      {client.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
