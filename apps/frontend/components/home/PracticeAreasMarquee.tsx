import Link from 'next/link';
import { Marquee } from '@/components/home/Marquee';
import type { PracticeAreaDto, PracticeAreaCategory } from '@shared/practice-area';

// Member count per area isn't in the contract yet — flagged, not faked. Falls back to a
// category-color dot when an area has no image.
const CATEGORY_LABEL: Record<PracticeAreaCategory, string> = {
  taxation: 'Tax',
  legal: 'Legal',
  finance_advisory: 'Finance & Advisory',
};

const CATEGORY_DOT: Record<PracticeAreaCategory, string> = {
  taxation: 'bg-accent',
  legal: 'bg-accent-2',
  finance_advisory: 'bg-neon',
};

export function PracticeAreasMarquee({ practiceAreas }: { practiceAreas: PracticeAreaDto[] }) {
  if (practiceAreas.length === 0) return null;

  return (
    <Marquee
      items={practiceAreas}
      rows={4}
      speeds={[44, 52, 48, 56]}
      itemKey={(p) => p.id}
      renderItem={(p) => (
        <Link
          href={`/members?practiceAreaId=${p.id}`}
          className="flex w-[240px] items-center gap-3 rounded-2xl border border-line bg-bg-card p-3.5 transition-colors hover:border-line-2"
        >
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt=""
              className="h-11 w-11 flex-none rounded-xl object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 flex-none rounded-full ${CATEGORY_DOT[p.category]}`}
            />
          )}
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium text-ink">{p.name}</div>
            <div className="font-mono text-[11px] text-ink-3">{CATEGORY_LABEL[p.category]}</div>
          </div>
        </Link>
      )}
    />
  );
}
