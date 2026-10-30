import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { loadWorkerEnv } from './config/env';
import { SearchWorkerModule } from './search-worker/worker.module';

const logger = new Logger('SearchWorker');

// Standalone Nest application context: no HTTP port. SIGTERM/SIGINT trigger a graceful close
// that waits for any in-flight batch (see IntervalLoop.stop) before the process exits.
async function bootstrap(): Promise<void> {
  loadWorkerEnv();
  const app = await NestFactory.createApplicationContext(SearchWorkerModule);
  app.enableShutdownHooks();
  logger.log('Search worker running.');
}

bootstrap().catch((err: unknown) => {
  logger.error('Search worker failed to start', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
