import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { normalizeCountry } from '../ai/countries';
import type { DocType } from './card.types';
import { matchStrength } from './match-strength';
import { composeAnswer } from './answer';
import { judge, judgePrompt, matchLines, questionTokens, trimCard } from './judge';
import { OpenAiClient } from './openai.client';
import { fallbackPlan, makePlan } from './planner';
import { redactResponseText, scrubResponse } from './redaction';
import { SEARCH_SETTINGS } from './search.config';
import { SearchRepository } from './search.repository';
import type {
  DegradedTag,
  Hit,
  Plan,
  SearchOutcome,
  SearchResult,
  StageTimings,
} from './search.types';
import type { SearchFeedbackResponse, SearchResponse } from '@shared/search';
import { resultTitle } from './search.types';
import { TopicEmbeddingService } from './topic-embedding.service';

const SCOPE_TO_TYPE: Record<string, DocType> = { members: 'member', articles: 'article', events: 'event' };
const ALL_TYPES: DocType[] = ['member', 'article', 'event'];

export interface RunSearchOptions {
  scope?: string;
  limit?: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly repo: SearchRepository,
    private readonly openai: OpenAiClient,
    private readonly topics: TopicEmbeddingService
  ) {}

  /** POST /v1/search with a question: run the pipeline, log it, return the contract body. */
  async search(userId: string, rawQuery: string | undefined, opts: RunSearchOptions): Promise<SearchResponse> {
    const question = (rawQuery ?? '').trim();
    if (question.length < 2 || question.length > 500) {
      throw new BadRequestException('query must be 2-500 characters');
    }

    const started = Date.now();
    const out = await this.runSearch(question, opts);
    const ms = Date.now() - started;

    let logId: string | null = null;
    try {
      logId = await this.repo.insertQueryLog({
        userId,
        question,
        plan: out.plan,
        applied: out.applied,
        resultRefs: out.results.map((r) => ({ type: r.type, id: r.id, title: resultTitle(r) })),
        answer: out.answer,
        degraded: out.degraded,
        ms,
      });
    } catch (err) {
      this.logger.error(`Query log insert failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { logId, answer: out.answer, results: out.results, applied: out.applied, degraded: out.degraded, ms };
  }

  /** Thumbs up/down on an earlier answer, scoped to the caller's own log row. */
  async feedback(userId: string, logId: string | undefined, rating: number | undefined, note: string | undefined): Promise<SearchFeedbackResponse> {
    if (!logId || (rating !== 1 && rating !== -1)) {
      throw new BadRequestException('logId and rating (1 or -1) are required');
    }
    const ok = await this.repo.setFeedback(logId, userId, rating, (note ?? '').slice(0, 500) || null);
    return { ok };
  }

  /**
   * The search pipeline: planner -> normalize -> embed ->
   * hybrid -> relax -> hydrate -> judge -> redact. The AI never writes SQL.
   */
  async runSearch(question: string, opts: RunSearchOptions = {}): Promise<SearchOutcome> {
    const degraded: DegradedTag[] = [];
    const timings: StageTimings = { planner: 0, embedding: 0, hybrid: 0, judge: 0 };
    const timed = async <T>(stage: keyof StageTimings, fn: () => Promise<T>): Promise<T> => {
      const t0 = Date.now();
      try {
        return await fn();
      } finally {
        timings[stage] += Date.now() - t0;
      }
    };

    // 1. plan (falls back to a plain keyword search if the AI is unavailable)
    let plan: Plan;
    try {
      plan = await timed('planner', () => makePlan(this.openai, question));
    } catch (err) {
      this.logger.error(`Planner failed: ${err instanceof Error ? err.message : String(err)}`);
      degraded.push('planner');
      plan = fallbackPlan(question);
    }
    plan.doc_types = plan.doc_types ?? [];
    plan.countries = plan.countries ?? [];
    plan.service_terms = plan.service_terms ?? [];
    const isDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : null);
    plan.date_from = isDate(plan.date_from);
    plan.date_to = isDate(plan.date_to);

    // The planner returns date-only strings. As an upper bound a bare date means midnight at the START of
    // that day, which would exclude everything later on the last day ("events on 29 February 2028" has
    // date_from = date_to and found nothing). Make the upper bound inclusive: end of that day (UTC).
    const dateToInclusive =
      plan.date_to && /^\d{4}-\d{2}-\d{2}$/.test(plan.date_to) ? `${plan.date_to}T23:59:59.999Z` : plan.date_to;

    const scoped = opts.scope ? SCOPE_TO_TYPE[opts.scope] : undefined;
    const docTypes: DocType[] = scoped ? [scoped] : plan.doc_types.length ? plan.doc_types : ALL_TYPES;

    // 2. resolve names to real values
    const countries: string[] = plan.countries.slice(0, 5).map(normalizeCountry).filter(Boolean);
    // terms are independent: look them up in parallel, merge in term order (same set order as sequential)
    const serviceIds = new Set<string>();
    const matched = await Promise.all(plan.service_terms.slice(0, 4).map((term) => this.repo.matchServices(term, SEARCH_SETTINGS.serviceMatchLimit)));
    for (const rows of matched) {
      for (const s of rows) {
        if (s.score >= 0.5) serviceIds.add(s.service_id);
      }
    }

    // 3. embed the topic (cached); skipped for filter-only questions.
    // A question with no topic AND no filters at all (for example a bare name) is searched as written.
    const hasFilters =
      plan.countries.length > 0 || !!plan.city || plan.service_terms.length > 0 || !!plan.date_from ||
      !!plan.date_to || plan.max_hourly_rate_usd != null || plan.requested_count != null;
    let topic: string | null = plan.semantic_query?.trim() || null;
    if (!topic && !hasFilters) topic = question.trim();
    const embedding = topic ? await timed('embedding', () => this.embedTopic(topic as string, degraded)) : null;

    // 4. search (fetch extra candidates when an AI re-score follows); if nothing matches, relax soft filters one at a time
    const wanted = Math.min(Math.max(opts.limit ?? plan.requested_count ?? SEARCH_SETTINGS.defaultLimit, 1), 20);
    const candidateLimit = topic ? Math.min(wanted * SEARCH_SETTINGS.candidateMultiplier, 30) : wanted;
    let searchTopic: string | null = topic;
    let searchEmbedding: string | null = embedding;
    let activeCountries: string[] = countries;
    const relaxed: string[] = [];
    let svcIds: string[] | null = serviceIds.size ? [...serviceIds] : null;
    let city: string | null = plan.city;
    let hits: Hit[] = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      hits = await timed('hybrid', () => this.repo.hybrid({
        query: searchTopic,
        embedding: searchEmbedding,
        docTypes,
        countries: activeCountries.length ? activeCountries : null,
        dateFrom: plan.date_from,
        dateTo: dateToInclusive,
        rateMaxCents: plan.max_hourly_rate_usd != null ? Math.round(plan.max_hourly_rate_usd * 100) : null,
        limit: candidateLimit,
        minSimilarity: SEARCH_SETTINGS.minVecSimilarity,
        serviceIds: svcIds,
        city,
      }));
      if (hits.length) break;
      if (svcIds) { svcIds = null; relaxed.push('practice-area filter'); }
      else if (city) { city = null; relaxed.push('city filter'); }
      else if (topic && activeCountries.length) {
        // a place named together with a topic may describe the topic, not the person's location
        activeCountries = [];
        relaxed.push('country filter');
        searchTopic = `${topic} ${countries.join(' ')}`;
        const reEmbed = searchTopic;
        searchEmbedding = await timed('embedding', () => this.embedTopic(reEmbed, degraded));
      } else break;
    }
    const sims = hits.map((h) => h.vec_sim).filter((v): v is number => typeof v === 'number');
    const topSimilarity = sims.length ? Math.max(...sims) : null;

    // The judge's card texts depend only on the hit ids, so fetch them while hydrating. A failure
    // is held until the judge step so it still degrades to 'judge' instead of failing the search.
    const cardsPromise = hits.length ? this.repo.cardContents(hits.map((h) => h.source_id)) : null;
    cardsPromise?.catch(() => undefined);
    let results = await timed('hybrid', () => this.repo.hydrate(hits));

    // 5. judge + answer
    // Scoring is on for topic questions AND whenever a filter was relaxed: relaxed results no longer
    // "already match the filters", so they must be judged (and labelled) instead of all getting a 10.
    // Pure filter questions where nothing was relaxed stay unscored, exactly as before.
    const applyScores = !!topic || relaxed.length > 0;
    const judgeFocus = topic ?? question; // what the candidates are judged against; plan/embedding untouched
    const practiceAreaRelaxed = relaxed.includes('practice-area filter');
    // Deterministic (not LLM-written) honesty notes about relaxed filters, shown before the answer.
    const notes: string[] = [];
    if (practiceAreaRelaxed) {
      notes.push(`No one matched "${plan.service_terms.join(', ')}" exactly, so these are the closest results without that requirement.`);
    }
    const otherRelaxed = relaxed.filter((r) => r !== 'practice-area filter');
    if (otherRelaxed.length > 0) {
      notes.push(`Nothing matched with the ${otherRelaxed.join(' and ')}, so ${otherRelaxed.length === 1 ? 'it was' : 'they were'} dropped.`);
    }
    let answer = '';
    let judgeRaw: SearchOutcome['debug']['judge'] = null;
    if (results.length === 0) {
      answer = [...notes, 'I could not find anything matching that. Try different wording or fewer filters.'].join(' ');
    } else {
      try {
        const cards = await timed('judge', () => cardsPromise ?? this.repo.cardContents(results.map((r) => r.id)));
        const tokens = questionTokens(judgeFocus);
        const lines = results.map((r, i) => {
          const card = cards.get(`${r.type}:${r.id}`) ?? '';
          const hit = matchLines(card, tokens);
          return `${i + 1}. [${String(r.type).toUpperCase()}] ${trimCard(r.type, card)}${hit ? ' || Lines that mention the question words: ' + hit : ''}`;
        });
        const dropped = relaxed.length ? `\nSome filters were dropped because nothing matched: ${relaxed.join(', ')}.` : '';
        const judgeUser = `Question: ${question}\nFilters applied by the database: ${JSON.stringify({ types: docTypes, countries: activeCountries, city, dates: [plan.date_from, plan.date_to] })}${dropped}\n\nCandidates:\n${lines.join('\n')}`;
        const judged = await timed('judge', () => judge(this.openai, judgePrompt(applyScores), judgeUser));
        judgeRaw = { scores: judged.scores, candidates: lines.length };
        const byN = new Map<number, number>();
        const reasonByN = new Map<number, string>();
        for (const s of judged.scores) {
          byN.set(s.n, s.score);
          if (s.reason?.trim()) reasonByN.set(s.n, s.reason.trim());
        }
        // While the practice-area filter still holds, every result already matched it, i.e. the member/article
        // declared that service, so the AI score is never allowed to fall below 7 for them (rule enforced here,
        // not left to the AI). Once that filter was relaxed they did NOT match it: no floor, raw scores decide.
        const practiceAreaHeld = !!svcIds && !practiceAreaRelaxed;
        const floor = practiceAreaHeld ? 7 : 0;
        let kept = results.map((r, i) => ({
          r, i, raw: byN.get(i + 1) ?? 0, s: Math.max(byN.get(i + 1) ?? 0, floor), reason: reasonByN.get(i + 1),
        }));
        if (applyScores) {
          kept = kept.filter((x) => x.s >= SEARCH_SETTINGS.judgeMinScore);
          kept.sort((a, b) => b.s - a.s || a.i - b.i);
        }
        results = kept.slice(0, wanted).map((x): SearchResult => ({
          ...x.r,
          relevance: applyScores ? x.s : undefined,
          match: applyScores ? matchStrength(x.raw) : undefined,
          reason: applyScores ? x.reason : undefined,
        }));
        answer = composeAnswer(results, applyScores, notes);
      } catch (err) {
        this.logger.error(`Judge failed: ${err instanceof Error ? err.message : String(err)}`);
        degraded.push('judge');
        results = results.slice(0, wanted);
        answer = [...notes, `Showing ${results.length} result${results.length === 1 ? '' : 's'} that best match your question.`].join(' ');
      }
    }

    return {
      answer: redactResponseText(answer),
      results: scrubResponse(results),
      plan,
      degraded,
      applied: {
        types: docTypes, topic, countries, city, serviceIds: svcIds,
        dateFrom: plan.date_from, dateTo: plan.date_to, maxHourlyRateUsd: plan.max_hourly_rate_usd,
        relaxed,
      },
      debug: { topSimilarity, candidates: hits.length, judge: judgeRaw, timings },
    };
  }

  private async embedTopic(topic: string, degraded: DegradedTag[]): Promise<string | null> {
    try {
      return await this.topics.embed(topic);
    } catch (err) {
      this.logger.error(`Embedding failed: ${err instanceof Error ? err.message : String(err)}`);
      if (!degraded.includes('embedding')) degraded.push('embedding');
      return null;
    }
  }
}
