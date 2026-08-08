import { Controller, Get } from '@nestjs/common';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './types/auth.types';

/**
 * Small smoke-test surface proving each rest-api.md access level end-to-end.
 * Real business endpoints (consultations, member directory, etc.) will get
 * their own controllers/modules as those features are built.
 */
@Controller()
export class AuthController {
  // 🔑 Auth — any authenticated role (client, member, or admin).
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  // 👤 Member — role must be 'member' or higher (admin included, per ROLE_RANK).
  @Roles('member')
  @Get('member/ping')
  memberPing(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, as: user.role };
  }

  // 🛡️ Admin — role must be exactly 'admin'.
  @Roles('admin')
  @Get('admin/ping')
  adminPing(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, as: user.role };
  }
}
