// interviews.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { Preparer } from './brain/preparer';
import { Tracker } from './brain/tracker';
import { TurnEngine } from './brain/turn-engine';
import { ElevenLabsClient } from './elevenlabs.client';
import { InterviewLlmController } from './interview-llm.controller';
import { InterviewLlmGuard } from './interview-llm.guard';
import { InterviewWebhooksController } from './interview-webhooks.controller';
import { InterviewWebhooksService } from './interview-webhooks.service';
import { InterviewsController } from './interviews.controller';
import { InterviewsCoreModule } from './interviews-core.module';
import { InterviewsService } from './interviews.service';
import { AdminInterviewsController } from './admin-interviews.controller';
import { AdminInterviewReviewController } from './admin-interview-review.controller';
import { InterviewReviewService } from './interview-review.service';

@Module({
  imports: [AuthModule, InterviewsCoreModule],
  controllers: [
    InterviewsController,
    InterviewLlmController,
    InterviewWebhooksController,
    AdminInterviewsController,
    AdminInterviewReviewController,
  ],
  providers: [
    InterviewsService,
    InterviewWebhooksService,
    InterviewReviewService,
    Preparer,
    Tracker,
    TurnEngine,
    ElevenLabsClient,
    InterviewLlmGuard,
  ],
})
export class InterviewsModule {}
