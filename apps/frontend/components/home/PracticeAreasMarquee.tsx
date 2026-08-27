import Link from 'next/link';
import { Marquee } from '@/components/home/Marquee';
import type { PracticeAreaDto, PracticeAreaCategory } from '@shared/practice-area';

// Ported from design/static_html/assets/home.js's initPracticeAreas. The design mockup pairs
// each practice area with a member count and a stock photo. `imageUrl` now exists on the real
// contract (docs/database-erd.md's practice_areas.image_url) and is rendered here; the member
// count is still not — a per-area aggregate count needs a separate contract addition (there's
// no accurate client-side way to derive it against a paginated member list) — flagged, not
// faked here. Falls back to a category-color dot when a given row has no image.
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
