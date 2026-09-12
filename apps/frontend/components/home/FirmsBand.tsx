import { Marquee } from '@/components/home/Marquee';
import type { MemberListItemDto } from '@shared/member';

// Derives unique firm names from the members list; no dedicated firms endpoint exists.
export function FirmsBand({ members }: { members: MemberListItemDto[] }) {
  const firms = Array.from(new Set(members.map((m) => m.firmName).filter((f): f is string => !!f)));
  if (firms.length === 0) return null;

  return (
    <Marquee
      items={firms}
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
