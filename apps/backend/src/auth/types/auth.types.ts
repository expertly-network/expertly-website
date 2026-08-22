export type Role = 'client' | 'member' | 'admin';

// Higher rank implies every permission of the ranks below it — an admin can do
// anything a member can, per RolesGuard's hierarchy check.
export const ROLE_RANK: Record<Role, number> = {
  client: 0,
  member: 1,
  admin: 2,
};

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}
