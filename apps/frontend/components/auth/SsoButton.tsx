'use client';

// `provider` stays typed for 'google' even though only 'linkedin' is wired up —
// re-enabling Google later (if ever needed) is then a one-line change here plus a
// call site, not a rewrite.
type SsoProvider = 'linkedin' | 'google';

interface SsoButtonProps {
  provider: SsoProvider;
  onClick: () => void;
  disabled?: boolean;
}

const LABELS: Record<SsoProvider, string> = {
  linkedin: 'Continue with LinkedIn',
  google: 'Continue with Google',
};

export function SsoButton({ provider, onClick, disabled }: SsoButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-input border border-line bg-bg px-3 py-3 text-sm font-medium text-ink transition-colors hover:bg-bg-alt disabled:cursor-not-allowed disabled:opacity-60"
    >
      {provider === 'linkedin' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#0077B5" aria-hidden="true">
          <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.2V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
        </svg>
      )}
      {LABELS[provider]}
    </button>
  );
}
