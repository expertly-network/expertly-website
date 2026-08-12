'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SignOutButton } from '@/components/nav/SignOutButton';
import type { Profile } from '@/lib/auth/types';

export function UserMenu({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const initial = (profile.first_name || profile.email).charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={profile.email}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-nav-green text-sm font-medium text-white"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-10 w-56 rounded-xl border border-line bg-bg-card p-2 shadow-lg">
          <div className="px-3 py-2 text-xs text-ink-3">{profile.email}</div>
          {(profile.role === 'member' || profile.role === 'admin') && (
            <Link
              href="/dashboard"
              className="block rounded-md px-3 py-2 text-sm text-ink-2 hover:bg-bg-alt"
            >
              Dashboard
            </Link>
          )}
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
