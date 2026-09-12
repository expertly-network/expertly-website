export function SectionBadge({ status }: { status: 'pending' | null }) {
  if (status !== 'pending') return null;

  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-amber-700">
      Pending verification
    </span>
  );
}
