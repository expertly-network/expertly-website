import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OpenAiClient } from './openai.client';
import { EMBEDDING_DIMENSIONS, SEARCH_OPENAI_TIMEOUT_MS, embedModel } from './search.config';

const MAX_ENTRIES = 1000;
const TTL_MS = 24 * 60 * 60 * 1000;

interface Entry {
  vector: string;
  expiresAt: number;
}

/** In-memory LRU/TTL cache of topic embeddings (replaces search_embedding_cache). */
@Injectable()
export class TopicEmbeddingService {
  private readonly cache = new Map<string, Entry>();

  constructor(private readonly openai: OpenAiClient) {}

  private key(topic: string): string {
    return createHash('sha256')
      .update(`${embedModel()}|${EMBEDDING_DIMENSIONS}|${topic.toLowerCase().trim()}`)
      .digest('hex');
  }

  /** Returns the embedding as the text '[0.1,0.2,…]' that search_hybrid expects. Throws on failure. */
  async embed(topic: string): Promise<string> {
    const key = this.key(topic);
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      this.cache.delete(key); // re-insert to mark as most recently used
      this.cache.set(key, hit);
      return hit.vector;
    }
    const [embedding] = await this.openai.embed([topic], SEARCH_OPENAI_TIMEOUT_MS);
    const vector = `[${embedding.join(',')}]`;
    this.cache.set(key, { vector, expiresAt: Date.now() + TTL_MS });
    if (this.cache.size > MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return vector;
  }
}
