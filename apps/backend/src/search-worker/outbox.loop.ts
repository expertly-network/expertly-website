import { BeforeApplicationShutdown, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OutboxService } from '../search/outbox.service';
import { IntervalLoop } from './interval-loop';

const OUTBOX_INTERVAL_MS = 15_000;

/**
 * Disabled unless SEARCH_OUTBOX_WORKER_ENABLED=true. While the old pg_cron `search-process-outbox`
 * job is still scheduled, two card builders would overwrite each other — only enable this AFTER
 * that job is unscheduled (cutover).
 */
@Injectable()
export class OutboxLoop implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(OutboxLoop.name);
  private readonly loop = new IntervalLoop(
    'outbox',
    OUTBOX_INTERVAL_MS,
    async (shouldStop) => {
      await this.outbox.run(shouldStop);
    },
    this.logger
  );

  constructor(private readonly outbox: OutboxService) {}

  onApplicationBootstrap(): void {
    if (process.env.SEARCH_OUTBOX_WORKER_ENABLED !== 'true') {
      this.logger.warn('Outbox loop DISABLED (set SEARCH_OUTBOX_WORKER_ENABLED=true after unscheduling the pg_cron outbox job).');
      return;
    }
    this.loop.start();
    this.logger.log(`Outbox loop started (every ${OUTBOX_INTERVAL_MS / 1000}s).`);
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.loop.stop();
  }
}
