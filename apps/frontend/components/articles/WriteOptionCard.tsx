import type { ReactNode } from 'react';

export function WriteOptionCard({
  icon,
  title,
  description,
  minutes,
  ctaLabel,
  dark = false,
  badge,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  minutes: number;
  ctaLabel: string;
  dark?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-card-lg border-[1.5px] p-[34px_32px] text-left shadow-[0_1px_2px_rgba(0,0,0,0.02),0_24px_48px_-32px_rgba(0,0,0,0.16)] transition-all duration-[250ms] hover:-translate-y-[5px] hover:shadow-[0_24px_48px_-26px_rgba(0,0,0,0.2)] ${
        dark
          ? 'border-ink bg-ink text-bg hover:scale-[1.008] hover:shadow-[0_28px_56px_-22px_rgba(0,0,0,0.35)]'
          : 'border-line-2 bg-bg-card hover:border-ink-3'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-[25%] -top-[55%] h-[220px] w-[220px] rounded-full ${
          dark
            ? 'bg-[radial-gradient(circle,color-mix(in_oklab,var(--accent)_20%,transparent)_0%,transparent_70%)]'
            : 'bg-[radial-gradient(circle,color-mix(in_oklab,var(--ink)_4%,transparent)_0%,transparent_70%)]'
        }`}
      />

      {badge && (
        <span className="absolute right-[22px] top-[22px] z-10 rounded-full bg-bg-card px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-ink shadow-[0_4px_12px_-4px_rgba(0,0,0,0.3)]">
          {badge}
        </span>
      )}

      <div className="relative z-10">
        <div
          className={`mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] transition-transform duration-[250ms] group-hover:scale-[1.08] group-hover:-rotate-[4deg] ${
            dark ? 'bg-white/10 text-bg-card' : 'bg-bg-alt text-ink-2'
          }`}
        >
          {icon}
        </div>
        <div className={`mb-2 text-[19px] font-semibold tracking-[-0.015em] ${dark ? 'text-bg-card' : 'text-ink'}`}>
          {title}
        </div>
        <p className={`mb-[22px] text-[13.5px] leading-[1.55] ${dark ? 'text-white/55' : 'text-ink-3'}`}>
          {description}
        </p>
        <div className={`flex items-center justify-between gap-2.5 border-t pt-4 ${dark ? 'border-white/15' : 'border-line'}`}>
          <span className={`inline-flex items-center gap-[5px] text-[11px] font-medium ${dark ? 'text-white/40' : 'text-ink-4'}`}>
            ~{minutes} min
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-[13px] font-semibold transition-[gap] duration-150 group-hover:gap-[9px] ${dark ? 'text-bg-card' : 'text-ink'}`}
          >
            {ctaLabel} →
          </span>
        </div>
      </div>
    </button>
  );
}
