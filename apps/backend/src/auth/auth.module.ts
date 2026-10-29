import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseService } from './supabase.service';
import { ProfilesRepository } from './profiles.repository';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminPermissionGuard } from './guards/admin-permission.guard';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { AuthController } from './auth.controller';
import { AdminAccessService } from './admin-access.service';

@Module({
  controllers: [AuthController],
  providers: [
    SupabaseService,
    ProfilesRepository,
    AdminAccessService,
    // Guards run in this order: authenticate, rate-limit (per user, so it needs request.user),
    // check role, then check permission. Rate limiting comes before the role/permission guards so
    // their fresh DB reads can't be used to hammer the database.
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AdminPermissionGuard },
  ],
  exports: [SupabaseService, ProfilesRepository, AdminAccessService],
})
export class AuthModule {}
