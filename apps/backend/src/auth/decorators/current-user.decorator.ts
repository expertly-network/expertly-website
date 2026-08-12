import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/auth.types';

// Reads the user SupabaseAuthGuard already resolved and attached to the
// request. Only valid on non-@Public() routes — undefined otherwise.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);
