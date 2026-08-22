import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { verifySupabaseToken } from '../verify-token';

/**
 * Applied globally (see app.module.ts's APP_GUARD provider). Every route
 * requires a valid Supabase bearer token unless marked @Public().
 *
 * Verifies the token's signature against the project's JWKS (public keys,
 * fetched once and cached) — no network call to Supabase Auth, no DB query.
 * Role/name come straight off the token's claims (see verify-token.ts for
 * exactly what's in there, and why this isn't a shared-secret HS256 check).
 *
 * This trades a small amount of staleness (a role/name change takes up to
 * ~1hr, until the token next refreshes, to take effect here) for removing a
 * network + DB round-trip from every single request. RolesGuard compensates
 * for the staleness on 🛡️ Admin routes specifically by re-checking the DB.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      request.user = await verifySupabaseToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired session.');
    }

    return true;
  }
}

function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}
