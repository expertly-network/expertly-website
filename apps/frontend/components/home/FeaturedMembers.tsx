import Image from 'next/image';
import { mustHotlink } from '@/lib/images';
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
            <Image
              src={m.photoUrl}
              unoptimized={mustHotlink(m.photoUrl)}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 flex-none rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-neon text-xs font-semibold text-ink-2">
              {m.initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate text-[13.5px] font-medium leading-5 text-ink">
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
            {/* Four fixed single lines — name, service, category, then city/country — each truncating
                so a long value never wraps the tile to an uneven height. */}
            {m.services[0] && (
              <>
                <div className="mt-0.5 truncate text-[11px] leading-4 text-ink-2" title={m.services[0].name}>
                  {m.services[0].name}
                </div>
                <div className="mt-0.5 truncate text-[11px] leading-4 text-ink-3" title={m.services[0].categoryName}>
                  {m.services[0].categoryName}
                </div>
              </>
            )}
            {/* Same pin as MemberCard's location line in the directory. */}
            <div className="mt-1 flex min-w-0 items-center gap-1 text-[11px] leading-4 text-ink-3">
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
