'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { SidebarNav, SidebarFooter } from '@/components/layout/Sidebar';
import type { Profile } from '@/lib/auth/types';

// Mobile-only (below 1024px, matching Sidebar's own breakpoint and the
// profile page's mobile CTA bar breakpoint — one number for the whole
// shell). No prototype reference for this collapse; built fresh per
// CLAUDE.md's mobile-first mandate.
export function MobileDrawer({ user }: { user: Profile | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg-card px-4 py-3 min-[1024px]:hidden">
        <Logo variant="nav" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-1.5 text-ink"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 min-[1024px]:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink pb-4">
            <div className="flex items-center justify-between px-5 py-6">
              <Logo variant="sidebar" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
            <SidebarNav user={user} variant="full" />
            <SidebarFooter user={user} variant="full" />
          </div>
        </div>
      )}
    </>
  );
}
