'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui';
import { loginHref } from '@/lib/auth/return-to';

// Sign-in entry points that bring the visitor back to the page they were on after logging in
// (an article, a member profile, the events calendar, ...) instead of dropping them on the home
// page. Server components can't read the current path, hence these small client wrappers.

export function SignInButton(props: Omit<Extract<ComponentProps<typeof Button>, { href: string }>, 'href'>) {
  const pathname = usePathname();
  return <Button {...props} href={loginHref(pathname || '/')} />;
}

export function SignInLink(props: Omit<ComponentProps<typeof Link>, 'href'>) {
  const pathname = usePathname();
  return <Link {...props} href={loginHref(pathname || '/')} />;
}
