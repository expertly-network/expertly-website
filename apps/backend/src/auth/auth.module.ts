import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminPermissionGuard } from './guards/admin-permission.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [
    SupabaseService,
    // Registration order matters: SupabaseAuthGuard must resolve req.user
    // before RolesGuard can check it, and RolesGuard must confirm the base
    // 'admin' role before AdminPermissionGuard narrows to a specific
    // permission. NestJS runs multiple APP_GUARD providers in the order
    // they're registered here.
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AdminPermissionGuard },
  ],
  exports: [SupabaseService],
})
export class AuthModule {}
