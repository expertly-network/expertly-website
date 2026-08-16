import { Marquee } from '@/components/home/Marquee';
import { SEED_FIRMS } from '@/lib/design-seed-data';

// Ported from home.js's initFirmsBand (2 rows, opposite direction).
export function FirmsBand() {
  return (
    <Marquee
      items={SEED_FIRMS}
      rows={2}
      speeds={[42, 50]}
      itemKey={(f) => f}
      renderItem={(f) => (
        <span className="flex h-14 w-[200px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[15px] font-semibold tracking-tight text-white/70">
          {f}
        </span>
      )}
    />
  );
}
