import { BeforeApplicationShutdown, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EmailSenderService } from '../email/email-sender.service';
import { IntervalLoop } from './interval-loop';
@Injectable()
export class EmailSendLoop implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly loop = new IntervalLoop(
    'email-send',
    5000,
    async (shouldStop) => {
      await this.service.run(shouldStop);
    },
    new Logger(EmailSendLoop.name)
  );
  constructor(private readonly service: EmailSenderService) {}
  onApplicationBootstrap(): void {
    if (process.env.EMAIL_WORKER_ENABLED === 'true') this.loop.start();
  }
  async beforeApplicationShutdown(): Promise<void> {
    await this.loop.stop();
  }
}
