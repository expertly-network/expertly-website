import type { Profile, Role } from '@/lib/auth/types';

// Where a signed-in user lands when a page isn't for them (there is no /dashboard yet):
// admins go to the admin console, everyone else to the home page.
export function homePathFor(role: Role): string {
  return role === 'admin' ? '/admin' : '/';
}

// Membership "Apply" CTAs only make sense for visitors and clients — /apply redirects a member
// or admin straight back out, so those buttons are hidden for them.
export function canApplyForMembership(user: Profile | null): boolean {
  return !user || user.role === 'client';
}
