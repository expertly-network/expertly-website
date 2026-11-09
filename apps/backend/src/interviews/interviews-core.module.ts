// interviews/interviews-core.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { Extractor } from './brain/extractor';
import { ElevenLabsClient } from './elevenlabs.client';
import { InterviewConfig } from './interview.config';
import { InterviewExtractionService } from './interview-extraction.service';
import { InterviewLlmService } from './interview-llm.service';
import { InterviewsRepository } from './interviews.repository';

// Shared by the API module and the worker (which must not register controllers).
@Module({
  imports: [AuthModule, EmailModule],
  providers: [
    InterviewConfig,
    InterviewLlmService,
    InterviewsRepository,
    Extractor,
    InterviewExtractionService,
    ElevenLabsClient,
  ],
  exports: [
    InterviewConfig,
    InterviewLlmService,
    InterviewsRepository,
    Extractor,
    InterviewExtractionService,
    ElevenLabsClient,
  ],
})
export class InterviewsCoreModule {}
