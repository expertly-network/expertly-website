import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase.service';
import { REQUIRED_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { adminRoleHasPermission, type AdminPermission, type AdminRole } from '../constants/admin-permissions';
import type { AuthenticatedUser } from '../types/auth.types';

/**
 * Opt-in via @RequiresPermission('manageMembers') — always paired with @Roles('admin') on the
 * same route (this guard doesn't itself check the base role). Runs after RolesGuard, so a caller
 * reaching here has already passed the fresh admin.role/status check; this narrows further by
 * fresh-reading profiles.admin_role and checking it against the ADMIN_PERMISSIONS map. Same
 * false-denials-are-safe asymmetry as RolesGuard: a stale/just-changed admin_role fails closed.
 */
@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService
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

    const { data: profile, error } = await this.supabase.db
      .from('profiles')
      .select('role, admin_role')
      .eq('id', user.id)
      .single();

    if (error || !profile || profile.role !== 'admin') {
      throw new ForbiddenException('Admin access could not be freshly confirmed.');
    }

    const adminRole = profile.admin_role as AdminRole | null;
    if (!adminRoleHasPermission(adminRole, requiredPermission)) {
      throw new ForbiddenException(
        `Requires permission: ${requiredPermission}. Your admin role (${adminRole ?? 'super_admin'}) does not have it.`
      );
    }

    return true;
  }
}
