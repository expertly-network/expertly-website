import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { StatsRepository } from './stats.repository';

@Module({
  imports: [AuthModule],
  controllers: [StatsController],
  providers: [StatsService, StatsRepository],
})
export class StatsModule {}
