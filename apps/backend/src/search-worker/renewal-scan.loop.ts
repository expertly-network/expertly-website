import { BeforeApplicationShutdown, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RenewalRemindersService } from '../email/renewal-reminders.service';
import { IntervalLoop } from './interval-loop';
@Injectable()
export class RenewalScanLoop implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly loop = new IntervalLoop(
    'renewal-scan',
    3600000,
    async (shouldStop) => {
      await this.service.run(new Date(), shouldStop);
    },
    new Logger(RenewalScanLoop.name)
  );
  constructor(private readonly service: RenewalRemindersService) {}
  onApplicationBootstrap(): void {
    if (process.env.EMAIL_WORKER_ENABLED === 'true') this.loop.start();
  }
  async beforeApplicationShutdown(): Promise<void> {
    await this.loop.stop();
  }
}
