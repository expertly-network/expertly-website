import { BeforeApplicationShutdown, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { HousekeepingService } from '../search/housekeeping.service';
import { IntervalLoop } from './interval-loop';

// The cleanup is idempotent, so it simply runs at start-up and every 6 hours (no "last run" state
// to keep). Replaces the pg_cron `search-housekeeping` job (daily 21:30 UTC).
const HOUSEKEEPING_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class HousekeepingLoop implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(HousekeepingLoop.name);
  private readonly loop = new IntervalLoop(
    'housekeeping',
    HOUSEKEEPING_INTERVAL_MS,
    async () => {
      await this.housekeeping.run();
    },
    this.logger
  );

  constructor(private readonly housekeeping: HousekeepingService) {}

  onApplicationBootstrap(): void {
    this.loop.start();
    this.logger.log('Housekeeping loop started (every 6h).');
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.loop.stop();
  }
}
