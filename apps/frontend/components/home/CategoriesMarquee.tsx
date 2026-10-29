import Link from 'next/link';
import { MARQUEE_TILE_HEIGHT, Marquee } from '@/components/home/Marquee';
import type { CategoryDto } from '@shared/category';

// Member count per category isn't in the contract yet — flagged, not faked. Same tile size as
// FeaturedMembers (280px × MARQUEE_TILE_HEIGHT); falls back to a
// neutral dot when a category has no image (the old 3-value enum's color coding no longer
// applies now that categories are real rows, not a fixed taxonomy).
export function CategoriesMarquee({ categories }: { categories: CategoryDto[] }) {
  if (categories.length === 0) return null;

  return (
    <Marquee
      items={categories}
      rows={4}
      speeds={[44, 52, 48, 56]}
      itemKey={(c) => c.id}
      renderItem={(c) => (
        <Link
          href={`/members?categoryId=${c.id}`}
          className={`flex w-[280px] ${MARQUEE_TILE_HEIGHT} items-center gap-3 rounded-2xl border border-line bg-bg-card p-3.5 transition-colors hover:border-line-2`}
        >
          {c.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async"
              src={c.imageUrl}
              alt=""
              className="h-16 w-16 flex-none rounded-xl object-cover"
            />
          ) : (
            <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full bg-accent" />
          )}
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium text-ink">{c.name}</div>
            <div className="font-mono text-[11px] text-ink-3">
              {c.services.length} service{c.services.length === 1 ? '' : 's'}
            </div>
          </div>
        </Link>
      )}
    />
  );
}
