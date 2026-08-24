import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MembersController } from './members.controller';
import { AdminMembersController } from './admin-members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [AuthModule],
  controllers: [MembersController, AdminMembersController],
  providers: [MembersService],
})
export class MembersModule {}
