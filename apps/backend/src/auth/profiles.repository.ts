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

const PROFILE_CONTACT_COLUMNS = ['phoneCountryCode:phone_country_code', 'phone'] as const;

export interface ProfileContactRow {
  phoneCountryCode: string | null;
  phone: string | null;
}

@Injectable()
export class ProfilesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private profiles() {
    return this.supabase.db.from('profiles');
  }

  // Looks up a profile's role/status/admin_role by id. Returns null if not found or on error.
  async findById(userId: string): Promise<ProfileRoleRow | null> {
    const { data, error } = await this.profiles()
      .select(PROFILE_ROLE_COLUMNS.join(', '))
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    return data as unknown as ProfileRoleRow;
  }

  // phone_country_code/phone aren't in the Supabase JWT's custom claims (only first/last name
  // and role are), so the frontend's fast-path session read can't see them — this is the one
  // real DB read needed to prefill a phone field. Returns null phone/phoneCountryCode (not a
  // null row) when the caller never set one, which is the common case for OAuth signups.
  async findContactById(userId: string): Promise<ProfileContactRow | null> {
    const { data, error } = await this.profiles()
      .select(PROFILE_CONTACT_COLUMNS.join(', '))
      .eq('id', userId)
      .maybeSingle();

    if (error) return null;
    return data as unknown as ProfileContactRow | null;
  }
}
