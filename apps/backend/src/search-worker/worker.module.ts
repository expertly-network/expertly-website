import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { EmbedderLoop } from './embedder.loop';
import { HousekeepingLoop } from './housekeeping.loop';
import { OutboxLoop } from './outbox.loop';

@Module({
  imports: [SearchModule],
  providers: [EmbedderLoop, OutboxLoop, HousekeepingLoop],
})
export class SearchWorkerModule {}
