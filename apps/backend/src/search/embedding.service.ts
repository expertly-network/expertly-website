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

type PendingDoc = Awaited<ReturnType<SearchRepository['pendingEmbeddings']>>[number];

function quarantineKey(doc: PendingDoc): string {
  return `${doc.id}:${doc.content_hash}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Fills in vectors for search_documents rows that are new or changed. Safe to call repeatedly. */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  // Docs OpenAI keeps rejecting (by id + content hash). Without this, one bad doc fails its whole
  // batch every run and — since pending docs are picked oldest-first — blocks the queue behind it
  // forever. In memory: a restart, or the doc's content changing, retries it.
  private readonly quarantined = new Set<string>();

  constructor(
    private readonly repo: SearchRepository,
    private readonly openai: OpenAiClient
  ) {}

  // One request for the batch; if that fails, one request per doc so a single bad input only
  // costs itself. Returns a vector per doc, or null for a doc that failed alone (quarantined).
  private async embedBatch(docs: PendingDoc[]): Promise<(number[] | null)[]> {
    const inputs = docs.map((d) => d.content.slice(0, EMBED_MAX_CHARS));
    try {
      return await this.openai.embed(inputs);
    } catch (batchError) {
      this.logger.warn(`Embedding batch of ${docs.length} failed, retrying one by one: ${errorMessage(batchError)}`);
    }
    const vectors: (number[] | null)[] = [];
    for (let i = 0; i < docs.length; i++) {
      try {
        const [vector] = await this.openai.embed([inputs[i]]);
        vectors.push(vector);
      } catch (error) {
        this.quarantined.add(quarantineKey(docs[i]));
        this.logger.error(`Embedding failed for search_documents ${docs[i].id}; skipping it: ${errorMessage(error)}`);
        vectors.push(null);
      }
    }
    return vectors;
  }

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
      // Over-fetch by the quarantine size so quarantined docs (oldest-first, so always at the
      // front) can't crowd every healthy doc out of the batch.
      const docs = (await this.repo.pendingEmbeddings(EMBED_BATCH_SIZE + this.quarantined.size))
        .filter((d) => !this.quarantined.has(quarantineKey(d)))
        .slice(0, EMBED_BATCH_SIZE);
      if (docs.length === 0) break;
      rounds++;

      const vectors = await this.embedBatch(docs);
      const results = await Promise.all(
        docs.flatMap((doc, i) => {
          const vector = vectors[i];
          return vector ? [this.repo.storeEmbedding(doc.id, doc.content_hash, vector, model)] : [];
        })
      );
      for (const stored of results) {
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
