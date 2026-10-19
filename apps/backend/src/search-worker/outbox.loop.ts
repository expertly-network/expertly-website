import { BeforeApplicationShutdown, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OutboxService } from '../search/outbox.service';
import { IntervalLoop } from './interval-loop';

const OUTBOX_INTERVAL_MS = 15_000;

/** Rebuilds search cards for records the DB triggers queued in search_outbox. */
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
    this.loop.start();
    this.logger.log(`Outbox loop started (every ${OUTBOX_INTERVAL_MS / 1000}s).`);
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.loop.stop();
  }
}
