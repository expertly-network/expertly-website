import type { ButtonHTMLAttributes } from 'react';

// Matches design/static_html/assets/styles.css's `.anv-write-submit`/`.anv-ai-generate-btn` — the
// write flow's own primary-action button, visually distinct from the app's normal `Button`
// component (dark gradient that shifts to the accent gradient on hover, deeper shadow, small lift).
export function WriteSubmitButton({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center gap-2 self-start rounded-[11px] bg-[linear-gradient(135deg,var(--ink),#1a1a1c)] px-[26px] py-[13px] text-sm font-semibold text-bg-card shadow-[0_10px_24px_-12px_rgba(0,0,0,0.35)] transition-all duration-150 hover:-translate-y-px hover:bg-[linear-gradient(135deg,var(--accent),#00b38a)] hover:shadow-[0_14px_28px_-12px_color-mix(in_oklab,var(--accent)_55%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-[linear-gradient(135deg,var(--ink),#1a1a1c)] ${className}`.trim()}
    >
      {children}
    </button>
  );
}
