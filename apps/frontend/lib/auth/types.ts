export type Role = 'client' | 'member' | 'admin';

export interface Profile {
  id: string;
  role: Role;
  first_name: string;
  last_name: string;
  email: string;
}
