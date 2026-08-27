// Tailwind's default amber palette, not a design-system token — see the
// design spec §9: this is the first and only call site needing an
// in-review/caution color, so a new CSS-variable token isn't warranted yet.
export function SectionBadge({ status }: { status: 'pending' | null }) {
  if (status !== 'pending') return null;

  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-amber-700">
      Pending verification
    </span>
  );
}
