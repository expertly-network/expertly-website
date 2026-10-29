import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifySupabaseToken } from '../auth/verify-token';
import type { AuthenticatedUser } from '../auth/types/auth.types';
@Injectable()
export class OptionalResourceAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{
        headers: { authorization?: string };
        user?: AuthenticatedUser;
      }>();
    const header = request.headers.authorization;
    if (!header) return true;
    const [scheme, token, extra] = header.split(' ');
    if (scheme !== 'Bearer' || !token || extra)
      throw new UnauthorizedException('Invalid bearer token.');
    try {
      request.user = await verifySupabaseToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired session.');
    }
    return true;
  }
}
