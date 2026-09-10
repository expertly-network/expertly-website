import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import type { Role } from './types/auth.types';
import type { AdminRole } from './constants/admin-permissions';

const PROFILE_ROLE_COLUMNS = ['role', 'status', 'admin_role'] as const;

export interface ProfileRoleRow {
  role: Role;
  status: string;
  admin_role: AdminRole | null;
}

@Injectable()
export class ProfilesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  // Looks up a profile's role/status/admin_role by id. Returns null if not found or on error.
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
