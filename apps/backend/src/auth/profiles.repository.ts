import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import type { Role } from './types/auth.types';
import type { AdminRole } from './constants/admin-permissions';

// One shape covers both guards' needs (RolesGuard reads role/status, AdminPermissionGuard reads
// role/admin_role) — same table, same single-row-by-id lookup, not worth two near-duplicate
// queries.
const PROFILE_ROLE_COLUMNS = ['role', 'status', 'admin_role'] as const;

export interface ProfileRoleRow {
  role: Role;
  status: string;
  admin_role: AdminRole | null;
}

@Injectable()
export class ProfilesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  // Returns null on any failure (no row, or a Supabase error) — both guards treat those cases
  // identically (fail closed), so the collapse happens here rather than duplicated in each guard.
  async findById(userId: string): Promise<ProfileRoleRow | null> {
    const { data, error } = await this.supabase.db
      .from('profiles')
      .select(PROFILE_ROLE_COLUMNS.join(', '))
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    return data as unknown as ProfileRoleRow;
  }
}
