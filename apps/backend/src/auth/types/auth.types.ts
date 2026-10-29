export type Role = 'client' | 'member' | 'admin';

// Numeric ranking used to compare roles — a higher rank includes every permission of the ranks below it.
export const ROLE_RANK: Record<Role, number> = {
  client: 0,
  member: 1,
  admin: 2,
};

/** profiles.status, from the `app_status` claim. Only 'active' accounts get past SupabaseAuthGuard. */
export type AccountStatus = 'active' | 'suspended' | 'deleted';

/** member_profiles.status, from the `app_member_status` claim; null for non-members. */
export type MemberStatus = 'active' | 'deactivated' | null;

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  memberStatus: MemberStatus;
  firstName: string;
  lastName: string;
}
