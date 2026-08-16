import Link from 'next/link';
import { Marquee } from '@/components/home/Marquee';
import { SEED_MEMBERS, type SeedMember } from '@/lib/design-seed-data';

// Ported from home.js's initFeaturedMembers (4 rows, alternating direction, per-row speed).
export function FeaturedMembers() {
  return (
    <Marquee
      items={SEED_MEMBERS}
      rows={4}
      speeds={[46, 58, 50, 54]}
      itemKey={(m) => m.id}
      renderItem={(m: SeedMember) => (
        <Link
          href={`/members#${m.id}`}
          className="flex w-[280px] items-center gap-3 rounded-2xl border border-line bg-bg-card p-3.5 transition-colors hover:border-line-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.img} alt="" className="h-12 w-12 flex-none rounded-full object-cover" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-ink">
              {m.name}
              {m.verified && <span className="text-ok" aria-label="Verified">✓</span>}
            </div>
            <div className="truncate text-xs text-ink-3">{m.title}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
              <span className="rounded-full bg-bg-alt px-2 py-0.5 font-medium text-ink-2">{m.practice}</span>
              <span className="truncate text-ink-3">{m.location}</span>
            </div>
          </div>
        </Link>
      )}
    />
  );
}
