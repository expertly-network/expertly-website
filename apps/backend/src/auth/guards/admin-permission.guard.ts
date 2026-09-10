import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProfilesRepository } from '../profiles.repository';
import { REQUIRED_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { adminRoleHasPermission, type AdminPermission } from '../constants/admin-permissions';
import type { AuthenticatedUser } from '../types/auth.types';

/** Checks the current admin has the permission required by @RequiresPermission(). */
@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly profilesRepository: ProfilesRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<AdminPermission | undefined>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      throw new ForbiddenException('No authenticated user resolved for this route.');
    }

    const profile = await this.profilesRepository.findById(user.id);

    if (!profile || profile.role !== 'admin') {
      throw new ForbiddenException('Admin access could not be freshly confirmed.');
    }

    const adminRole = profile.admin_role;
    if (!adminRoleHasPermission(adminRole, requiredPermission)) {
      throw new ForbiddenException(
        `Requires permission: ${requiredPermission}. Your admin role (${adminRole ?? 'super_admin'}) does not have it.`
      );
    }

    return true;
  }
}
