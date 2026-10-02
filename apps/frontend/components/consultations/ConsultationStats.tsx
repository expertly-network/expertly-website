export function ConsultationStats({
  total,
  pending,
  completed,
  declined,
}: {
  total: number;
  pending: number;
  completed: number;
  declined: number;
}) {
  const tiles = [
    { label: 'Total', value: total },
    { label: 'Pending', value: pending },
    { label: 'Completed', value: completed },
    { label: 'Declined', value: declined },
  ];
  return (
    <div className="grid grid-cols-4 gap-3 max-[640px]:grid-cols-2">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-line bg-bg-card p-4">
          <div className="text-2xl font-bold text-ink">{tile.value}</div>
          <div className="text-caption text-ink-3">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}
