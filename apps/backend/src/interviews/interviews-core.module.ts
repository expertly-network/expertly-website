// interviews/interviews-core.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { Drafter } from './brain/drafter';
import { Scorer } from './brain/scorer';
import { ElevenLabsClient } from './elevenlabs.client';
import { InterviewConfig } from './interview.config';
import { InterviewExtractionService } from './interview-extraction.service';
import { InterviewLlmService } from './interview-llm.service';
import { InterviewResultsRepository } from './interview-results.repository';
import { InterviewScoringService } from './interview-scoring.service';
import { InterviewsRepository } from './interviews.repository';

// Shared by the API module and the worker (which must not register controllers).
@Module({
  imports: [AuthModule, EmailModule],
  providers: [
    InterviewConfig,
    InterviewLlmService,
    InterviewsRepository,
    InterviewResultsRepository,
    Drafter,
    Scorer,
    InterviewExtractionService,
    InterviewScoringService,
    ElevenLabsClient,
  ],
  exports: [
    InterviewConfig,
    InterviewLlmService,
    InterviewsRepository,
    InterviewResultsRepository,
    Drafter,
    Scorer,
    InterviewExtractionService,
    InterviewScoringService,
    ElevenLabsClient,
  ],
})
export class InterviewsCoreModule {}
