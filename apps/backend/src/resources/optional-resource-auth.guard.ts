import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifySupabaseToken } from '../auth/verify-token';
import type { AuthenticatedUser } from '../auth/types/auth.types';

// Public routes where a valid bearer token unlocks role-specific content (member perks/videos).
// The same status rules as the global guards apply: a suspended/deleted account is served as a
// guest, and a deactivated member as a client — never member-tier content.
@Injectable()
export class OptionalResourceAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const header = request.headers.authorization;
    if (!header) return true;
    const [scheme, token, extra] = header.split(' ');
    if (scheme !== 'Bearer' || !token || extra)
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Invalid bearer token.' });
    let user: AuthenticatedUser;
    try {
      user = await verifySupabaseToken(token);
    } catch {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Invalid or expired session.' });
    }
    if (user.status !== 'active') return true;
    request.user = user.role === 'member' && user.memberStatus === 'deactivated' ? { ...user, role: 'client' } : user;
    return true;
  }
}
