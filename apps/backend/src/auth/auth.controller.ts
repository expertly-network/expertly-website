import { Body, Controller, Get, InternalServerErrorException, Post } from '@nestjs/common';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './types/auth.types';
import { SupabaseService } from './supabase.service';
import { RecordConsentDto } from './dto/record-consent.dto';
import type { ConsentStatusDto } from '@shared/consent';

/**
 * Small smoke-test surface proving each rest-api.md access level end-to-end.
 * Real business endpoints (consultations, member directory, etc.) will get
 * their own controllers/modules as those features are built.
 */
@Controller()
export class AuthController {
  constructor(private readonly supabase: SupabaseService) {}

  // 🔑 Auth — any authenticated role (client, member, or admin).
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  // 🔒 Owner — records the caller's own real, timestamped consent. Never fabricated by the
  // signup trigger (see supabase/migrations/0003_functions.sql's handle_new_user) — this is the
  // only place terms_accepted_at ever gets set. middleware.ts gates nearly every frontend route
  // on this having happened (via the JWT's consent_given claim), see docs/auth.md.
  @Post('me/consent')
  async recordConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordConsentDto
  ): Promise<ConsentStatusDto> {
    const { error } = await this.supabase.db
      .from('profiles')
      .update({ terms_accepted_at: new Date().toISOString(), marketing_consent: dto.marketingConsent })
      .eq('id', user.id);
    if (error) throw new InternalServerErrorException('Failed to record consent.');

    return { termsAccepted: true, marketingConsent: dto.marketingConsent };
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
