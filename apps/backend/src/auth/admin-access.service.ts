import { Injectable } from '@nestjs/common';
import { ProfilesRepository } from './profiles.repository';
import { adminRoleHasPermission, type AdminPermission } from './constants/admin-permissions';
import type { AuthenticatedUser } from './types/auth.types';

/**
 * For service-level "owner, or an admin" decisions. The JWT's admin claim is up to an hour stale
 * (a demoted or suspended admin keeps it until refresh), so an admin-only privilege is confirmed
 * against `profiles` fresh — same rule RolesGuard/AdminPermissionGuard apply to /admin routes.
 * Non-admin callers short-circuit to false with no DB read.
 */
@Injectable()
export class AdminAccessService {
  constructor(private readonly profilesRepository: ProfilesRepository) {}

  async hasFreshPermission(user: AuthenticatedUser, permission: AdminPermission): Promise<boolean> {
    if (user.role !== 'admin') return false;
    const profile = await this.profilesRepository.findById(user.id);
    return (
      profile !== null &&
      profile.role === 'admin' &&
      profile.status === 'active' &&
      adminRoleHasPermission(profile.admin_role, permission)
    );
  }
}
