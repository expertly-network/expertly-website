import 'dotenv/config';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { InterviewExtractLoop } from '../search-worker/interview-extract.loop';
import { InterviewConfig } from './interview.config';
import { InterviewsCoreModule } from './interviews-core.module';

@Module({ imports: [InterviewsCoreModule], providers: [InterviewExtractLoop] })
class InterviewWorkerModule {}

async function bootstrap(): Promise<void> {
  if (!new InterviewConfig().reasoning) throw new Error('Interview reasoning model is not configured.');
  const app = await NestFactory.createApplicationContext(InterviewWorkerModule);
  app.enableShutdownHooks();
  new Logger('InterviewWorker').log('Interview extraction worker running.');
}

bootstrap().catch((error: unknown) => {
  new Logger('InterviewWorker').error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
