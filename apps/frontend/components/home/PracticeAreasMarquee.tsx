import Link from 'next/link';
import { Marquee } from '@/components/home/Marquee';
import { SEED_PRACTICE_AREAS } from '@/lib/design-seed-data';

// Ported from home.js's initPracticeAreas.
export function PracticeAreasMarquee() {
  return (
    <Marquee
      items={SEED_PRACTICE_AREAS}
      rows={4}
      speeds={[44, 52, 48, 56]}
      itemKey={(p) => p.name}
      renderItem={(p) => (
        <Link
          href={`/members?practice=${encodeURIComponent(p.name)}`}
          className="flex w-[240px] items-center gap-3 rounded-2xl border border-line bg-bg-card p-3 transition-colors hover:border-line-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.img} alt="" className="h-11 w-11 flex-none rounded-xl object-cover" />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium text-ink">{p.name}</div>
            <div className="font-mono text-[11px] text-ink-3">{p.count} experts</div>
          </div>
        </Link>
      )}
    />
  );
}
