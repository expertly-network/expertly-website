import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseService } from './supabase.service';
import { ProfilesRepository } from './profiles.repository';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminPermissionGuard } from './guards/admin-permission.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [
    SupabaseService,
    ProfilesRepository,
    // Guards run in this order: authenticate, check role, then check permission.
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AdminPermissionGuard },
  ],
  exports: [SupabaseService, ProfilesRepository],
})
export class AuthModule {}
