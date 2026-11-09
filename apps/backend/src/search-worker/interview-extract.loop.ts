// search-worker/interview-extract.loop.ts
import { BeforeApplicationShutdown, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InterviewConfig } from '../interviews/interview.config';
import { InterviewExtractionService } from '../interviews/interview-extraction.service';
import { IntervalLoop } from './interval-loop';

@Injectable()
export class InterviewExtractLoop implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly loop = new IntervalLoop(
    'interview-extract',
    15_000,
    async (shouldStop) => {
      await this.service.run(shouldStop);
    },
    new Logger(InterviewExtractLoop.name)
  );
  constructor(
    private readonly service: InterviewExtractionService,
    private readonly config: InterviewConfig
  ) {}
  onApplicationBootstrap(): void {
    if (this.config.reasoning) this.loop.start();
  }
  async beforeApplicationShutdown(): Promise<void> {
    await this.loop.stop();
  }
}
