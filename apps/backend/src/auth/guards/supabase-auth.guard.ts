import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SupabaseService } from '../supabase.service';
import type { AuthenticatedUser } from '../types/auth.types';
import { verifySupabaseTokenClaims, type VerifiedToken } from '../verify-token';
import { StatusFallbackRepository } from './status-fallback.repository';

/** Verifies the request's bearer token and attaches the resulting user to the request. */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  // Constructed here rather than registered in AuthModule: it serves this guard alone.
  private readonly statusFallback: StatusFallbackRepository;

  constructor(
    private readonly reflector: Reflector,
    supabase: SupabaseService
  ) {
    this.statusFallback = new StatusFallbackRepository(supabase);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException({ code: 'SESSION_MISSING', message: 'Missing bearer token.' });
    }

    let verified: VerifiedToken;
    try {
      verified = await verifySupabaseTokenClaims(token);
    } catch {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Invalid or expired session.' });
    }
    request.user = verified.missingStatusClaims ? await this.withFreshStatus(verified.user) : verified.user;

    // Suspended/deleted accounts lose every authenticated route (claim-based, so it applies from
    // the user's next token refresh; admin routes re-check profiles.status fresh anyway).
    if (request.user.status !== 'active') {
      throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'This account is not active.' });
    }

    return true;
  }

  // A token minted before the hook emitted the status claims: read both statuses fresh rather
  // than assume active. A failed lookup is treated as not active.
  private async withFreshStatus(user: AuthenticatedUser): Promise<AuthenticatedUser> {
    const fresh = await this.statusFallback.findStatus(user.id);
    if (!fresh) return { ...user, status: 'suspended' };
    return { ...user, status: fresh.status, memberStatus: user.role === 'member' ? fresh.memberStatus : null };
  }
}

function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}
