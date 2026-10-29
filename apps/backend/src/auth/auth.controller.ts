import { Controller, Get } from '@nestjs/common';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ProfilesRepository } from './profiles.repository';
import type { AuthenticatedUser } from './types/auth.types';
import type { MeResponse, MyContactResponse } from '@shared/account';

/** Smoke-test endpoints, one per access level, plus the one real "my own profile" read below. */
@Controller()
export class AuthController {
  constructor(private readonly profilesRepository: ProfilesRepository) {}

  // 🔑 Auth — any authenticated role (client, member, or admin).
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): MeResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      memberStatus: user.memberStatus,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  // 🔑 Auth — the caller's own phone/phoneCountryCode, read fresh from `profiles` (the JWT's
  // claims don't carry it — see ProfilesRepository.findContactById's comment). Used to prefill
  // the consultation request form; both fields are null if the caller never set a phone number.
  @Get('me/contact')
  async getMyContact(@CurrentUser() user: AuthenticatedUser): Promise<MyContactResponse> {
    const contact = await this.profilesRepository.findContactById(user.id);
    return contact ?? { phoneCountryCode: null, phone: null };
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
