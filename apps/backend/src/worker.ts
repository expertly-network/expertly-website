import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SearchWorkerModule } from './search-worker/worker.module';

// Standalone Nest application context: no HTTP port. SIGTERM/SIGINT trigger a graceful close
// that waits for any in-flight batch (see IntervalLoop.stop) before the process exits.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SearchWorkerModule);
  app.enableShutdownHooks();
  new Logger('SearchWorker').log('Search worker running.');
}

void bootstrap();
