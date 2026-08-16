'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Icon-only logout button matching dashboard-shell.css's .d1-logout-btn (30x30, dark-sidebar
// treatment) — distinct from SignOutButton.tsx, which is styled as a full-width row inside a
// light-background dropdown and doesn't fit here.
export function SidebarSignOut() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      title="Log out"
      aria-label="Log out"
      className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    </button>
  );
}
