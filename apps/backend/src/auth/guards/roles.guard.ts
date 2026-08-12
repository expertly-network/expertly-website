import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ROLE_RANK, type AuthenticatedUser, type Role } from '../types/auth.types';

/**
 * Opt-in via @Roles('member' | 'admin'). Runs after SupabaseAuthGuard, so
 * `request.user` is always already populated from the JWT's claims here.
 * Higher-ranked roles satisfy lower requirements (admin passes an
 * @Roles('member') check).
 *
 * For 'admin' specifically, the claim alone isn't trusted — it's re-verified
 * against `profiles.role` in the DB, since a revoked admin's still-valid token
 * would otherwise keep asserting admin for up to ~1hr. Non-admin roles accept
 * the small staleness window in exchange for skipping a DB round-trip on
 * every request; extend this same fresh-check to individual destructive
 * Member endpoints as they're built (see CLAUDE.md).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      // SupabaseAuthGuard should always run first and populate this — a
      // missing user here means a route is misconfigured (e.g. @Public() +
      // @Roles() combined by mistake), not a legitimate anonymous request.
      throw new ForbiddenException('No authenticated user resolved for this route.');
    }

    const hasSufficientRole = requiredRoles.some(
      (required) => ROLE_RANK[user.role] >= ROLE_RANK[required]
    );
    if (!hasSufficientRole) {
      // A stale-but-under-privileged token (e.g. just-promoted-to-admin, token
      // not yet refreshed) fails here rather than being fresh-checked — the
      // asymmetry is intentional: false denials just mean "try again after
      // your token refreshes," which is safe, whereas false grants are not.
      throw new ForbiddenException(
        `Requires role: ${requiredRoles.join(' or ')}. You are: ${user.role}.`
      );
    }

    if (requiredRoles.includes('admin')) {
      await this.assertFreshAdmin(user);
    }

    return true;
  }

  private async assertFreshAdmin(user: AuthenticatedUser): Promise<void> {
    const { data: profile, error } = await this.supabase.db
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single();

    if (error || !profile || profile.status !== 'active' || profile.role !== 'admin') {
      throw new ForbiddenException('Admin access could not be freshly confirmed.');
    }
  }
}
