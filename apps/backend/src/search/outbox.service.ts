import { Injectable, Logger } from '@nestjs/common';
import { CardBuilderService } from './card-builder.service';
import type { CardResult, DocType } from './card.types';
import { SearchRepository, type OutboxJob } from './search.repository';

const CLAIM_BATCH = 100;
const TIME_BUDGET_MS = 10_000;

export interface OutboxRunResult {
  processed: number;
  failed: number;
}

/** Rebuilds search cards for records the DB triggers put in search_outbox. */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly repo: SearchRepository,
    private readonly cards: CardBuilderService
  ) {}

  /** Builds (without writing) the card for one record; null means no card should exist. */
  async buildCard(docType: DocType, sourceId: string): Promise<CardResult> {
    if (docType === 'member') {
      const src = await this.repo.loadMemberSource(sourceId);
      return src ? this.cards.buildMember(src) : null;
    }
    if (docType === 'article') {
      const src = await this.repo.loadArticleSource(sourceId);
      return src ? this.cards.buildArticle(src) : null;
    }
    const src = await this.repo.loadEventSource(sourceId);
    return src ? this.cards.buildEvent(src) : null;
  }

  private async rebuild(job: OutboxJob): Promise<void> {
    const card = await this.buildCard(job.doc_type, job.source_id);
    if (card) await this.repo.upsertDocument(card);
    else await this.repo.deleteDocument(job.doc_type, job.source_id);
  }

  /** Claims and processes batches until the queue is empty, the budget is spent, or `shouldStop`. */
  async run(shouldStop: () => boolean = () => false): Promise<OutboxRunResult> {
    const started = Date.now();
    let processed = 0;
    let failed = 0;
    while (Date.now() - started < TIME_BUDGET_MS && !shouldStop()) {
      const jobs = await this.repo.claimOutbox(CLAIM_BATCH);
      if (jobs.length === 0) break;
      for (const job of jobs) {
        try {
          await this.rebuild(job);
          await this.repo.completeOutbox(job, null);
          processed++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Card rebuild failed for ${job.doc_type} ${job.source_id}: ${message}`);
          await this.repo.completeOutbox(job, message);
          failed++;
        }
      }
    }
    if (processed > 0 || failed > 0) this.logger.log(`Outbox: ${processed} rebuilt, ${failed} failed.`);
    return { processed, failed };
  }
}
