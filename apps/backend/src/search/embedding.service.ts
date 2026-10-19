import { Injectable, Logger } from '@nestjs/common';
import { OpenAiClient } from './openai.client';
import { SearchRepository } from './search.repository';
import {
  EMBEDDING_DIMENSIONS,
  EMBED_BATCH_SIZE,
  EMBED_MAX_CHARS,
  EMBED_MAX_ROUNDS,
  EMBED_TIME_BUDGET_MS,
  embedModel,
} from './search.config';

export interface EmbedRunResult {
  embedded: number;
  stale: number;
  rounds: number;
  ms: number;
}

/** Fills in vectors for search_documents rows that are new or changed. Safe to call repeatedly. */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly repo: SearchRepository,
    private readonly openai: OpenAiClient
  ) {}

  /**
   * One run: up to EMBED_MAX_ROUNDS batches within EMBED_TIME_BUDGET_MS. `shouldStop` is checked
   * only between rounds, so a batch in flight always finishes (graceful shutdown).
   */
  async run(shouldStop: () => boolean = () => false): Promise<EmbedRunResult> {
    const started = Date.now();
    const model = `${embedModel()}@${EMBEDDING_DIMENSIONS}`;
    let embedded = 0;
    let stale = 0;
    let rounds = 0;

    while (Date.now() - started < EMBED_TIME_BUDGET_MS && rounds < EMBED_MAX_ROUNDS) {
      if (shouldStop()) break;
      const docs = await this.repo.pendingEmbeddings(EMBED_BATCH_SIZE);
      if (docs.length === 0) break;
      rounds++;

      const vectors = await this.openai.embed(docs.map((d) => d.content.slice(0, EMBED_MAX_CHARS)));
      for (let i = 0; i < docs.length; i++) {
        const stored = await this.repo.storeEmbedding(
          docs[i].id,
          docs[i].content_hash,
          vectors[i],
          model
        );
        if (stored) embedded++;
        else stale++;
      }
    }

    const ms = Date.now() - started;
    if (embedded > 0 || stale > 0) {
      this.logger.log(`Embedded ${embedded} (stale ${stale}) in ${rounds} round(s), ${ms}ms.`);
    }
    return { embedded, stale, rounds, ms };
  }
}
