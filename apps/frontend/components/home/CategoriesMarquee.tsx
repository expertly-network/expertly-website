import Image from 'next/image';
import Link from 'next/link';
import { MARQUEE_TILE_HEIGHT, Marquee } from '@/components/home/Marquee';
import type { CategoryDto } from '@shared/category';
import { mustHotlink } from '@/lib/images';

// Keep the scrolling coverage panel while allowing long practice-area names to wrap.
export function CategoriesMarquee({ categories }: { categories: CategoryDto[] }) {
  if (categories.length === 0) return null;

  return (
    <Marquee
      items={categories}
      rows={4}
      fill={{ minPerRow: 6, secondsPerItem: 8 }}
      itemKey={(c) => c.id}
      renderItem={(c) => (
        <Link
          href={`/members?categoryId=${c.id}`}
          className={`flex w-[340px] ${MARQUEE_TILE_HEIGHT} items-center gap-3 rounded-2xl border border-line bg-bg-card p-3.5 transition-colors hover:border-line-2`}
        >
          {c.imageUrl ? (
            <Image
              src={c.imageUrl}
              unoptimized={mustHotlink(c.imageUrl)}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 flex-none rounded-xl object-cover"
            />
          ) : (
            <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full bg-accent" />
          )}
          <div className="min-w-0">
            <div className="text-[13.5px] leading-snug [overflow-wrap:anywhere] font-medium text-ink">{c.name}</div>
            <div className="font-mono text-[11px] text-ink-3">
              {c.services.length} service{c.services.length === 1 ? '' : 's'}
            </div>
          </div>
        </Link>
      )}
    />
  );
}
