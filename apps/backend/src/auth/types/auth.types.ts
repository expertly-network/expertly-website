export type Role = 'client' | 'member' | 'admin';

// Numeric ranking used to compare roles — a higher rank includes every permission of the ranks below it.
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
