// Typed search config. Env-driven values are read lazily so importing SearchModule never crashes
// an process (e.g. the API) that doesn't need OpenAI.

/** Must match search_documents.embedding halfvec(768). */
export const EMBEDDING_DIMENSIONS = 768;

export const DEFAULT_EMBED_MODEL = 'text-embedding-3-small';

/** Texts per OpenAI embeddings request. */
export const EMBED_BATCH_SIZE = 32;
/** Max rounds per embedder run. */
export const EMBED_MAX_ROUNDS = 20;
/** Stop starting new rounds after this long, so runs never overlap the ~1 min tick. */
export const EMBED_TIME_BUDGET_MS = 45_000;
/** ~6k tokens, safely under the model input limit. */
export const EMBED_MAX_CHARS = 24_000;
export const OPENAI_TIMEOUT_MS = 30_000;

export function embedModel(): string {
  return process.env.OPENAI_EMBED_MODEL || DEFAULT_EMBED_MODEL;
}

/** Typed replacement for the old search_settings table. */
export const SEARCH_SETTINGS = {
  /** Cosine-similarity gate for the vector channel. */
  minVecSimilarity: 0.2,
  judgeMinScore: 3,
  candidateMultiplier: 3,
  defaultLimit: 10,
  /** Practice areas kept per planner service term (search_match_services caps at 25). A generic term such
   * as "tax" matches dozens of services with the same score, so a tiny limit silently picks an arbitrary few. */
  serviceMatchLimit: 25,
} as const;

/** Judge-score cut-offs for the match label shown with each result (0-10 scale). Anything kept but
 * below `good` is labelled 'possible' and listed under "you might also need". The lowest score ever
 * shown is SEARCH_SETTINGS.judgeMinScore. */
export const MATCH_STRENGTH = { strong: 8, good: 6 } as const;

/** Questions: 10/min + 100/hour per user. Feedback has its own looser 30/min bucket. In-memory,
 * so counts are per API instance. */
export const SEARCH_RATE_LIMIT = { perMinute: 10, perHour: 100, feedbackPerMinute: 30, retryAfterSeconds: 30 } as const;

export const DEFAULT_CHAT_MODEL = 'gpt-4.1-mini';
export function chatModel(): string {
  return process.env.OPENAI_CHAT_MODEL || DEFAULT_CHAT_MODEL;
}

/** Per-call timeout for planner / judge / query-embedding requests. */
export const SEARCH_OPENAI_TIMEOUT_MS = 25_000;
