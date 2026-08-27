import Link from 'next/link';
import { Marquee } from '@/components/home/Marquee';
import type { MemberListItemDto } from '@shared/member';

// Ported from design/static_html/assets/home.js's initFeaturedMembers (4 rows, alternating
// direction, per-row speed). Data comes from the real GET /v1/members (public, sort=featured)
// via the homepage's server-side fetch — no seed/mock data, this endpoint already exists.
// Compact tile, not the full components/members/MemberCard — that card's rate/tenure footer
// doesn't fit a 280px marquee row item; this is a genuinely different layout context, not a
// duplicate of that component.
export function FeaturedMembers({ members }: { members: MemberListItemDto[] }) {
  if (members.length === 0) return null;

  return (
    <Marquee
      items={members}
      rows={4}
      speeds={[46, 58, 50, 54]}
      itemKey={(m) => m.id}
      renderItem={(m) => (
        <Link
          href={`/members/${m.id}`}
          className="flex w-[280px] items-center gap-3 rounded-2xl border border-line bg-bg-card p-3.5 transition-colors hover:border-line-2"
        >
          {m.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.photoUrl} alt="" className="h-12 w-12 flex-none rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-neon text-xs font-semibold text-ink-2">
              {m.initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-ink">
              {m.name}
              {m.isVerified && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="flex-none text-ok"
                  aria-label="Verified"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path
                    d="M8 12.5l2.5 2.5L16 9"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            {m.headline && <div className="truncate text-xs text-ink-3">{m.headline}</div>}
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
              {m.practiceAreas[0] && (
                <span className="rounded-full bg-bg-alt px-2 py-0.5 font-medium text-ink-2">
                  {m.practiceAreas[0].name}
                </span>
              )}
              <span className="truncate text-ink-3">
                {[m.city, m.country].filter(Boolean).join(', ')}
              </span>
            </div>
          </div>
        </Link>
      )}
    />
  );
}
