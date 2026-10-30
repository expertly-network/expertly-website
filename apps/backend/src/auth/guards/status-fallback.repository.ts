import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import type { AccountStatus, MemberStatus } from '../types/auth.types';

const ACCOUNT_STATUSES: AccountStatus[] = ['active', 'suspended', 'deleted'];

export interface FreshStatus {
  status: AccountStatus;
  memberStatus: MemberStatus;
}

/**
 * Fresh profiles.status + member_profiles.status for a token that predates the app_status /
 * app_member_status claims (see verify-token.ts). Only SupabaseAuthGuard uses it, and only on that
 * rare path — the common case (claims present) never reads the database.
 */
@Injectable()
export class StatusFallbackRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private profiles() {
    return this.supabase.db.from('profiles');
  }

  private memberProfiles() {
    return this.supabase.db.from('member_profiles');
  }

  // Null when the lookup fails or the profile is missing — the caller then refuses the request.
  async findStatus(userId: string): Promise<FreshStatus | null> {
    const [{ data: profile, error: profileError }, { data: member, error: memberError }] = await Promise.all([
      this.profiles().select('status, deleted_at').eq('id', userId).maybeSingle(),
      this.memberProfiles().select('status').eq('profile_id', userId).maybeSingle(),
    ]);
    if (profileError || memberError || !profile) return null;

    const status: AccountStatus = profile.deleted_at
      ? 'deleted'
      : ACCOUNT_STATUSES.includes(profile.status as AccountStatus)
        ? (profile.status as AccountStatus)
        : 'suspended';
    const memberStatus: MemberStatus =
      member?.status === 'active' || member?.status === 'deactivated' ? member.status : null;
    return { status, memberStatus };
  }
}
