import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProfilesRepository } from '../profiles.repository';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ROLE_RANK, type AuthenticatedUser, type Role } from '../types/auth.types';

/** Checks the current user's role satisfies a route's @Roles() requirement. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly profilesRepository: ProfilesRepository
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
      throw new ForbiddenException('No authenticated user resolved for this route.');
    }

    const hasSufficientRole = requiredRoles.some(
      (required) => ROLE_RANK[user.role] >= ROLE_RANK[required]
    );
    if (!hasSufficientRole) {
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
    const profile = await this.profilesRepository.findById(user.id);

    if (!profile || profile.status !== 'active' || profile.role !== 'admin') {
      throw new ForbiddenException('Admin access could not be freshly confirmed.');
    }
  }
}
