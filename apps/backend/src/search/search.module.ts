import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { CardBuilderService } from './card-builder.service';
import { EmbeddingService } from './embedding.service';
import { HousekeepingService } from './housekeeping.service';
import { OpenAiClient } from './openai.client';
import { OutboxService } from './outbox.service';
import { SearchController } from './search.controller';
import { SEARCH_THROTTLERS, SearchThrottlerGuard } from './search-throttler.guard';
import { SearchRepository } from './search.repository';
import { SearchService } from './search.service';
import { TopicEmbeddingService } from './topic-embedding.service';

@Module({
  imports: [AuthModule, ThrottlerModule.forRoot({ throttlers: SEARCH_THROTTLERS })],
  controllers: [SearchController],
  providers: [
    SearchRepository,
    OpenAiClient,
    EmbeddingService,
    CardBuilderService,
    OutboxService,
    HousekeepingService,
    TopicEmbeddingService,
    SearchService,
    SearchThrottlerGuard,
  ],
  exports: [
    SearchRepository,
    OpenAiClient,
    EmbeddingService,
    CardBuilderService,
    OutboxService,
    HousekeepingService,
    SearchService,
  ],
})
export class SearchModule {}
