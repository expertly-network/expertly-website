import { Controller, Get } from '@nestjs/common';
import type { PlatformStatsResponse } from '@shared/platform-stats';
import { Public } from '../auth/decorators/public.decorator';
import { StatsService } from './stats.service';

// 🌐 GET /v1/stats — counts only, no personal data; the home hero's figures.
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Public()
  @Get()
  get(): Promise<PlatformStatsResponse> {
    return this.statsService.getPlatformStats();
  }
}
