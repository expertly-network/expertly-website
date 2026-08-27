import type { ReactNode } from 'react';
import { getSessionUser } from '@/lib/auth/session-claims';
import { AppShell } from '@/components/layout/AppShell';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  return <AppShell user={user}>{children}</AppShell>;
}
