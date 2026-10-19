import type {
  ArticleSearchResult,
  EventSearchResult,
  MemberSearchResult,
  SearchAppliedDto,
  SearchDegradedTag,
  SearchDocType,
  SearchResult,
} from '@shared/search';

// Public contract types live in packages/shared-types/search.ts (camelCase). Re-exported here so
// the module imports from one place; the types below are internal to the pipeline.
export type {
  ArticleSearchResult,
  EventSearchResult,
  MemberSearchResult,
  SearchAppliedDto as Applied,
  SearchDegradedTag as DegradedTag,
  SearchResult,
};
export type DocTypeName = SearchDocType;

/** Planner output: the user's question as typed filters. snake_case on purpose — it is the
 * verbatim planner JSON schema and is stored as-is in search_query_log.plan. */
export interface Plan {
  doc_types: SearchDocType[];
  semantic_query: string | null;
  countries: string[];
  city: string | null;
  service_terms: string[];
  date_from: string | null;
  date_to: string | null;
  max_hourly_rate_usd: number | null;
  requested_count: number | null;
}

/** One row of search_hybrid() (database column names). */
export interface Hit {
  doc_type: SearchDocType;
  source_id: string;
  title: string;
  score: number;
  vec_sim: number | null;
}

export interface JudgeOutput {
  scores: { n: number; score: number; reason: string }[];
}

/** Wall-clock milliseconds per pipeline stage (embedding includes any re-embed while relaxing). */
export interface StageTimings {
  planner: number;
  embedding: number;
  hybrid: number;
  judge: number;
}

export interface SearchOutcome {
  answer: string;
  results: SearchResult[];
  plan: Plan;
  degraded: SearchDegradedTag[];
  applied: SearchAppliedDto;
  debug: {
    topSimilarity: number | null;
    candidates: number;
    judge: { scores: JudgeOutput['scores']; candidates: number } | null;
    timings: StageTimings;
  };
}

export function resultTitle(r: SearchResult): string {
  return r.type === 'member' ? r.name : r.title;
}
