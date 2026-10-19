import { SEARCH_OPENAI_TIMEOUT_MS } from './search.config';
import type { OpenAiClient, OpenAiJsonSchema } from './openai.client';
import type { Plan } from './search.types';

// Tuned prompt + schema — VERBATIM from the Edge Function (reference/edge-functions/pipeline.ts.txt).
// Do not edit to make a test pass; planner-prompt.test.ts diffs it against the reference.
export const PLAN_SCHEMA: OpenAiJsonSchema = {
  name: 'search_plan',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['doc_types', 'semantic_query', 'countries', 'city', 'service_terms', 'date_from', 'date_to', 'max_hourly_rate_usd', 'requested_count'],
    properties: {
      doc_types: { type: 'array', items: { type: 'string', enum: ['member', 'article', 'event'] } },
      semantic_query: { type: ['string', 'null'] },
      countries: { type: 'array', items: { type: 'string' } },
      city: { type: ['string', 'null'] },
      service_terms: { type: 'array', items: { type: 'string' } },
      date_from: { type: ['string', 'null'] },
      date_to: { type: ['string', 'null'] },
      max_hourly_rate_usd: { type: ['number', 'null'] },
      requested_count: { type: ['integer', 'null'] },
    },
  },
};

export function plannerPrompt(today: string): string {
  return `You turn a user's question about a professional-network directory into a search plan.
The directory has three kinds of items: members (finance, tax and legal professionals), articles, and events.
Today's date is ${today}.
Rules:
- doc_types: only the kinds the user asks for. If unclear, include all three.
- semantic_query: the topic only (for example 'ESOP tax for foreign employees'). Remove countries, cities, dates, counts, prices and the words member/article/event. Use null if the question is only filters (for example '5 members from the UK' or 'upcoming events'). A name of a person or firm (for example 'M2K Advisors') is a topic, not a filter.
- countries: full English country names (expand UK, US, UAE and similar). Empty array if none mentioned.
- city: only if a city is mentioned, else null.
- service_terms: short practice-area phrases the user mentions (for example 'transfer pricing', 'GST', 'M&A tax'). Empty array if none.
- date_from/date_to: ISO dates (YYYY-MM-DD). Set them ONLY when the user explicitly mentions a time (for example 'upcoming', 'next month', 'in November', 'this year'); resolve them using today's date. If the user does not mention any time, both MUST be null. Never assume that event questions mean upcoming events.
- max_hourly_rate_usd: only if the user states a maximum price per hour, else null.
- requested_count: the number of results the user asked for, else null.
Never invent filters that are not in the question.`;
}

export function makePlan(openai: OpenAiClient, question: string): Promise<Plan> {
  const today = new Date().toISOString().slice(0, 10);
  return openai.chatJson<Plan>(plannerPrompt(today), question, PLAN_SCHEMA, SEARCH_OPENAI_TIMEOUT_MS);
}

/** Fallback plan when the planner is unavailable: plain keyword search of the question. */
export function fallbackPlan(question: string): Plan {
  return {
    doc_types: [], semantic_query: question, countries: [], city: null, service_terms: [],
    date_from: null, date_to: null, max_hourly_rate_usd: null, requested_count: null,
  };
}
