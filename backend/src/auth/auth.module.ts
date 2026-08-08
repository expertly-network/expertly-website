import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [
    SupabaseService,
    // Registration order matters: SupabaseAuthGuard must resolve req.user
    // before RolesGuard can check it. NestJS runs multiple APP_GUARD
    // providers in the order they're registered here.
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [SupabaseService],
})
export class AuthModule {}
