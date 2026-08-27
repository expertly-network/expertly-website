import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { Footer } from '@/components/layout/Footer';
import { HeroLogoHandoff } from '@/components/layout/HeroLogoHandoff';
import type { Profile } from '@/lib/auth/types';

export function AppShell({ user, children }: { user: Profile | null; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar user={user} />
      <MobileDrawer user={user} />
      <HeroLogoHandoff />
      {/* pl-14 (56px) matches the sidebar's collapsed rail width — the hover-expanded
          248px state floats over content as an overlay (box-shadow), it never pushes
          this offset, matching design/static_html's behavior. */}
      <div className="flex min-h-screen flex-col min-[1024px]:pl-14">
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
