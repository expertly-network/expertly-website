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
      mobileRows={2}
      fill={{ minPerRow: 6, secondsPerItem: 8 }}
      itemKey={(c) => c.id}
      renderItem={(c) => (
        <Link
          href={`/members?categoryId=${c.id}`}
          className={`flex w-[248px] sm:w-[250px] ${MARQUEE_TILE_HEIGHT} items-center gap-3 rounded-2xl border border-line bg-bg-card p-3.5 transition-colors hover:border-line-2`}
        >
          {c.imageUrl ? (
            <Image
              src={c.imageUrl}
              unoptimized={mustHotlink(c.imageUrl)}
              alt=""
              width={64}
              height={64}
              className="h-12 w-12 sm:h-16 sm:w-16 flex-none rounded-xl object-cover"
            />
          ) : (
            // No image yet: a tinted tile with the category's initial, so the card never reads as empty.
            <span
              aria-hidden="true"
              className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] font-brand text-title text-accent sm:h-16 sm:w-16"
            >
              {c.name.trim().charAt(0).toUpperCase()}
            </span>
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
