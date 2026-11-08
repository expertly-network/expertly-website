import { Marquee } from '@/components/home/Marquee';
import type { MemberListItemDto } from '@shared/member';

// Derives unique firm names from the members list; no dedicated firms endpoint exists.
export function FirmsBand({ members }: { members: MemberListItemDto[] }) {
  const firms = Array.from(new Set(members.map((m) => m.firmName).filter((f): f is string => !!f)));
  if (firms.length === 0) return null;

  // One firm should read as one endorsement, not a wall of repeated names.
  if (firms.length === 1) {
    return (
      <div className="mx-auto max-w-[1520px] px-5 sm:px-8">
        <span className="inline-flex min-h-16 items-center rounded-xl border border-white/10 bg-white/[0.04] px-6 py-4 text-base font-medium text-white/70">
          {firms[0]}
        </span>
      </div>
    );
  }

  return (
    <Marquee
      items={firms}
      rows={Math.min(2, firms.length)}
      mobileRows={1}
      fill={{ minPerRow: 8, secondsPerItem: 6 }}
      itemKey={(f) => f}
      renderItem={(f) => (
        <span className="flex min-h-20 w-[240px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center text-[15px] leading-relaxed [overflow-wrap:anywhere] font-semibold tracking-tight text-white/70">
          {f}
        </span>
      )}
    />
  );
}
