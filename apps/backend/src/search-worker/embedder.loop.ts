import { BeforeApplicationShutdown, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EmbeddingService } from '../search/embedding.service';
import { IntervalLoop } from './interval-loop';

const EMBED_INTERVAL_MS = 60_000;

@Injectable()
export class EmbedderLoop implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(EmbedderLoop.name);
  private readonly loop = new IntervalLoop(
    'embedder',
    EMBED_INTERVAL_MS,
    async (shouldStop) => {
      await this.embedding.run(shouldStop);
    },
    this.logger
  );

  constructor(private readonly embedding: EmbeddingService) {}

  onApplicationBootstrap(): void {
    this.loop.start();
    this.logger.log(`Embedder loop started (every ${EMBED_INTERVAL_MS / 1000}s).`);
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.loop.stop();
  }
}
