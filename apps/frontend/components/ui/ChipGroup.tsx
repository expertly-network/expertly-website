'use client';

// A single-choice row of pill buttons (a category / topic picker), scrolling sideways when it
// overflows — the next pill peeks at the edge as the scroll cue. Phones get a 44px tap height;
// from `sm` up the pills keep their compact 36px look.
export function ChipGroup({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  /** Accessible name for the group, e.g. "Template categories". */
  label: string;
  options: readonly string[];
  value: string;
  onChange: (option: string) => void;
  /** Spacing / visibility of the row, e.g. "mb-7" or "mb-6 hidden sm:flex". */
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex gap-2 overflow-x-auto pb-2 ${className}`}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`flex min-h-11 shrink-0 items-center rounded-full px-4 py-2.5 text-xs font-medium transition-colors sm:min-h-0 ${
            value === option ? 'bg-ink text-white' : 'bg-bg-alt text-ink-3 hover:text-ink'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
