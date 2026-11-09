import { EmailModule } from '../email/email.module';
import { EmailSendLoop } from './email-send.loop';
import { InterviewsCoreModule } from '../interviews/interviews-core.module';
import { InterviewExtractLoop } from './interview-extract.loop';
import { RenewalScanLoop } from './renewal-scan.loop';
import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { EmbedderLoop } from './embedder.loop';
import { HousekeepingLoop } from './housekeeping.loop';
import { OutboxLoop } from './outbox.loop';

@Module({
  imports: [SearchModule, EmailModule, InterviewsCoreModule],
  providers: [EmbedderLoop, OutboxLoop, HousekeepingLoop, EmailSendLoop, RenewalScanLoop, InterviewExtractLoop],
})
export class SearchWorkerModule {}
