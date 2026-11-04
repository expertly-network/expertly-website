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
    {
      label: 'Total',
      value: total,
      tone: 'border-t-accent',
      iconTone: 'bg-neon text-accent-2',
      valueTone: 'text-ink',
      icon: (
        <>
          <path d="M20.59 13.41L13.42 20.6a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <circle cx="7" cy="7" r="1.5" />
        </>
      ),
    },
    {
      label: 'Pending',
      value: pending,
      tone: 'border-t-warn-line',
      iconTone: 'bg-warn-soft text-warn',
      valueTone: 'text-warn',
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </>
      ),
    },
    {
      label: 'Completed',
      value: completed,
      tone: 'border-t-ok',
      iconTone: 'bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] text-ok',
      valueTone: 'text-ok',
      icon: <path d="M5 12l5 5L20 7" />,
    },
    {
      label: 'Declined',
      value: declined,
      tone: 'border-t-line-2',
      iconTone: 'bg-bg-alt text-ink-3',
      valueTone: 'text-ink-3',
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </>
      ),
    },
  ];
  return (
    <dl aria-label="Consultation statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={`flex min-w-0 items-center gap-3 rounded-panel border border-t-2 border-line bg-bg-card p-4 sm:p-5 ${tile.tone}`}
        >
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tile.iconTone}`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {tile.icon}
            </svg>
          </span>
          <div className="flex min-w-0 flex-col-reverse gap-1">
            <dt className="text-caption font-medium text-ink-3">{tile.label}</dt>
            <dd className={`text-stat font-semibold leading-none tabular-nums ${tile.valueTone}`}>{tile.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
