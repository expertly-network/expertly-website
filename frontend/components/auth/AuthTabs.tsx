'use client';

export type AuthMode = 'user' | 'member';

interface AuthTabsProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}

export function AuthTabs({ mode, onChange }: AuthTabsProps) {
  return (
    <div className="mb-6 inline-flex w-fit self-start rounded-full border border-line bg-bg-alt p-1">
      <button
        type="button"
        onClick={() => onChange('user')}
        className={`min-h-[36px] rounded-full px-[18px] py-2 text-[13px] font-medium transition-colors ${
          mode === 'user' ? 'bg-ink text-bg' : 'text-ink-3 hover:text-ink'
        }`}
      >
        User
      </button>
      <button
        type="button"
        onClick={() => onChange('member')}
        className={`min-h-[36px] rounded-full px-[18px] py-2 text-[13px] font-medium transition-colors ${
          mode === 'member' ? 'bg-ink text-bg' : 'text-ink-3 hover:text-ink'
        }`}
      >
        Member
      </button>
    </div>
  );
}
