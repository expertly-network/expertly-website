import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { Footer } from '@/components/layout/Footer';
import { HeroLogoHandoff } from '@/components/layout/HeroLogoHandoff';
import { FloatingSearch } from '@/components/search/FloatingSearch';
import type { Profile } from '@/lib/auth/types';

export function AppShell({ user, children }: { user: Profile | null; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar user={user} />
      <MobileDrawer user={user} />
      <HeroLogoHandoff />
      <div className="flex min-h-screen flex-col min-[1024px]:pl-14">
        {/* At least a full screen tall (minus the mobile top bar), so the footer always starts
            below the fold even on a page with little content. */}
        <main className="min-h-[calc(100svh-59px)] flex-1 min-[1024px]:min-h-[100svh]">{children}</main>
        <Footer />
      </div>
      <FloatingSearch />
    </div>
  );
}
