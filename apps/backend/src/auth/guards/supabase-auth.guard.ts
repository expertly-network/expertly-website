import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { verifySupabaseToken } from '../verify-token';

/** Verifies the request's bearer token and attaches the resulting user to the request. */
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
      throw new UnauthorizedException({ code: 'SESSION_MISSING', message: 'Missing bearer token.' });
    }

    try {
      request.user = await verifySupabaseToken(token);
    } catch {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Invalid or expired session.' });
    }

    // Suspended/deleted accounts lose every authenticated route (claim-based, so it applies from
    // the user's next token refresh; admin routes re-check profiles.status fresh anyway).
    if (request.user.status !== 'active') {
      throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'This account is not active.' });
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
