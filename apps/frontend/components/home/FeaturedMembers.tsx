import Link from 'next/link';
import { MARQUEE_TILE_HEIGHT, Marquee } from '@/components/home/Marquee';
import type { MemberListItemDto } from '@shared/member';

// A compact tile distinct from MemberCard, sized to fit a marquee row.
export function FeaturedMembers({ members }: { members: MemberListItemDto[] }) {
  if (members.length === 0) return null;

  return (
    <Marquee
      items={members}
      rows={4}
      // 6 × 292px tiles ≈ 1750px per row, wider than the panel at any breakpoint, so a short
      // member list repeats to fill every row; one shared pace (~24px/s) for all four rows.
      fill={{ minPerRow: 6, secondsPerItem: 12 }}
      itemKey={(m) => m.id}
      renderItem={(m) => (
        <Link
          href={`/members/${m.slug}`}
          className={`flex w-[280px] ${MARQUEE_TILE_HEIGHT} items-center gap-3 rounded-2xl border border-line bg-bg-card p-3.5 transition-colors hover:border-line-2`}
        >
          {m.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.photoUrl} alt="" className="h-12 w-12 flex-none rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-neon text-xs font-semibold text-ink-2">
              {m.initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
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
            {/* Three fixed single lines — name, service · category, city, country — so a long
                service name truncates instead of wrapping the tile to an uneven height. */}
            {m.services[0] && (
              <div
                className="mt-1.5 flex max-w-full"
                title={`${m.services[0].name} · ${m.services[0].categoryName}`}
              >
                <span className="truncate rounded-full bg-bg-alt px-2 py-0.5 text-[11px] text-ink-3">
                  <span className="font-medium text-ink-2">{m.services[0].name}</span>
                  {' · '}
                  {m.services[0].categoryName}
                </span>
              </div>
            )}
            {/* Same pin as MemberCard's location line in the directory. */}
            <div className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-ink-3">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="flex-none text-ink-4"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate">{[m.city, m.country].filter(Boolean).join(', ')}</span>
            </div>
          </div>
        </Link>
      )}
    />
  );
}
