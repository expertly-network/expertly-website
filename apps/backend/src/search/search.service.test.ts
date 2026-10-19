import { describe, expect, it, vi } from 'vitest';
import type { OpenAiClient } from './openai.client';
import type { SearchRepository } from './search.repository';
import { SearchService } from './search.service';
import type { Hit, Plan, SearchResult } from './search.types';
import type { TopicEmbeddingService } from './topic-embedding.service';

// Degraded paths: a failing AI stage must not fail the search — results still come back, tagged.

const PLAN: Plan = {
  doc_types: ['member'], semantic_query: 'transfer pricing', countries: [], city: null,
  service_terms: [], date_from: null, date_to: null, max_hourly_rate_usd: null, requested_count: null,
};
const HITS: Hit[] = [
  { doc_type: 'member', source_id: 'm1', title: 'Asha Rao', score: 0.03, vec_sim: 0.9 },
  { doc_type: 'member', source_id: 'm2', title: 'Bob Lee', score: 0.02, vec_sim: 0.5 },
];
const RESULTS: SearchResult[] = HITS.map((h) => ({
  type: 'member', id: h.source_id, name: h.title, slug: h.source_id, headline: null, firm: null,
  location: '', services: [], available: true, rate: null,
}));

function build(chatJson: (system: string) => Promise<unknown>, embed: () => Promise<string> = async () => '[0.1]') {
  const repo = {
    matchServices: vi.fn().mockResolvedValue([]),
    hybrid: vi.fn().mockResolvedValue(HITS),
    hydrate: vi.fn().mockResolvedValue(RESULTS),
    cardContents: vi.fn().mockResolvedValue(new Map([['member:m1', 'Member: Asha Rao'], ['member:m2', 'Member: Bob Lee']])),
    insertQueryLog: vi.fn().mockResolvedValue('log-1'),
  };
  const openai = { chatJson: vi.fn((system: string) => chatJson(system)) };
  const topics = { embed: vi.fn(embed) };
  const service = new SearchService(
    repo as unknown as SearchRepository,
    openai as unknown as OpenAiClient,
    topics as unknown as TopicEmbeddingService
  );
  return { service, repo, openai, topics };
}

const isPlanner = (system: string) => system.startsWith('You turn a user');

describe('SearchService degraded paths', () => {
  it("judge timeout -> degraded ['judge'] and the unscored results are still returned", async () => {
    const { service } = build(async (system) => {
      if (isPlanner(system)) return PLAN;
      throw new Error('The operation was aborted due to timeout');
    });
    const response = await service.search('user-a', 'transfer pricing experts', {});
    expect(response.degraded).toEqual(['judge']);
    expect(response.results.map((r) => (r.type === 'member' ? r.name : ''))).toEqual(['Asha Rao', 'Bob Lee']);
    expect(response.answer).toBe('Showing 2 result(s) that best match your question.');
    expect(response.logId).toBe('log-1');
  });

  it("planner failure -> degraded ['planner'], falls back to a keyword search of the question", async () => {
    const { service, repo } = build(async (system) => {
      if (isPlanner(system)) throw new Error('OpenAI chat/completions 500');
      return { scores: [{ n: 1, score: 9 }, { n: 2, score: 8 }], answer: 'Asha Rao and Bob Lee.' };
    });
    const response = await service.search('user-a', 'transfer pricing experts', {});
    expect(response.degraded).toEqual(['planner']);
    expect(response.results).toHaveLength(2);
    expect(repo.hybrid.mock.calls[0][0].query).toBe('transfer pricing experts');
  });

  it("embedding failure -> degraded ['embedding'], still searches by keyword (no vector)", async () => {
    const { service, repo } = build(
      async (system) => (isPlanner(system) ? PLAN : { scores: [{ n: 1, score: 9 }, { n: 2, score: 9 }], answer: 'ok' }),
      async () => {
        throw new Error('embeddings down');
      }
    );
    const response = await service.search('user-a', 'transfer pricing experts', {});
    expect(response.degraded).toEqual(['embedding']);
    expect(repo.hybrid.mock.calls[0][0].embedding).toBeNull();
    expect(response.results).toHaveLength(2);
  });

  it('a healthy run is not degraded and keeps only judge-approved results', async () => {
    const { service } = build(async (system) =>
      isPlanner(system) ? PLAN : { scores: [{ n: 1, score: 9 }, { n: 2, score: 1 }], answer: 'Asha Rao is the best match.' }
    );
    const response = await service.search('user-a', 'transfer pricing experts', {});
    expect(response.degraded).toEqual([]);
    expect(response.results.map((r) => r.id)).toEqual(['m1']);
  });

  it('a card-fetch failure is held until the judge step and degrades to judge', async () => {
    const { service, repo } = build(async (system) =>
      isPlanner(system) ? PLAN : { scores: [], answer: 'unused' }
    );
    repo.cardContents.mockRejectedValue(new Error('search_documents read failed'));
    const response = await service.search('user-a', 'transfer pricing experts', {});
    expect(response.degraded).toEqual(['judge']);
    expect(response.results).toHaveLength(2);
  });
});

// Scoring when a filter was relaxed (UK + GST style questions). The planner returns filters only
// (semantic_query null); when no UK member has a GST service the practice-area filter is relaxed and
// the results must be judged and honestly labelled — not all handed a score of 10.
describe('SearchService scoring after a relaxed filter', () => {
  const UK_GST_QUESTION = 'I am looking for somebody in the UK who has experience in GST.';
  const GIVE_EVERY_10 = 'give every candidate a score of 10';
  const NOTE = 'No one matched "GST" exactly, so these are the closest results without that requirement.';

  const plan = (over: Partial<Plan> = {}): Plan => ({
    doc_types: ['member'], semantic_query: null, countries: ['United Kingdom'], city: null,
    service_terms: ['GST'], date_from: null, date_to: null, max_hourly_rate_usd: null, requested_count: null,
    ...over,
  });

  /** n candidates c1..cn whose cards contain NO GST service; the judge returns `scores` in order. */
  function buildScoring(opts: { plan: Plan; scores: number[]; relaxPracticeArea: boolean; answer?: string }) {
    const n = opts.scores.length;
    const hits: Hit[] = Array.from({ length: n }, (_, i) => ({
      doc_type: 'member', source_id: `c${i + 1}`, title: `Member ${i + 1}`, score: 0.03 - i * 0.001, vec_sim: null,
    }));
    const results: SearchResult[] = hits.map((h) => ({
      type: 'member', id: h.source_id, name: h.title, slug: h.source_id, headline: null, firm: null,
      location: 'London, United Kingdom', services: ['Employment / Labour laws / Social Security'], available: true, rate: null,
    }));
    const cards = new Map(hits.map((h) => [`member:${h.source_id}`, `Member: ${h.title}\nPractice areas: Employment / Labour laws / Social Security`]));
    const repo = {
      matchServices: vi.fn().mockResolvedValue(opts.plan.service_terms.length ? [{ service_id: 'svc-gst', score: 0.9 }] : []),
      // with the practice-area filter set and relaxPracticeArea, nothing matches until it is dropped
      hybrid: vi.fn(async (args: { serviceIds: string[] | null }) => (opts.relaxPracticeArea && args.serviceIds ? [] : hits)),
      hydrate: vi.fn().mockResolvedValue(results),
      cardContents: vi.fn().mockResolvedValue(cards),
    };
    const judgeSystems: string[] = [];
    const openai = {
      chatJson: vi.fn(async (system: string) => {
        if (isPlanner(system)) return JSON.parse(JSON.stringify(opts.plan));
        judgeSystems.push(system);
        return { scores: opts.scores.map((score, i) => ({ n: i + 1, score })), answer: opts.answer ?? 'Judge answer.' };
      }),
    };
    const topics = { embed: vi.fn(async () => '[0.1]') };
    const service = new SearchService(
      repo as unknown as SearchRepository,
      openai as unknown as OpenAiClient,
      topics as unknown as TopicEmbeddingService
    );
    return { service, repo, topics, judgeSystems };
  }

  const matchOf = (r: SearchResult) => r.match;

  it('a) practice area relaxed + no topic: scored, sorted, labelled from raw scores, honest note, no floor of 7', async () => {
    const { service, repo, topics, judgeSystems } = buildScoring({ plan: plan(), scores: [2, 5, 9, 3], relaxPracticeArea: true });
    const out = await service.runSearch(UK_GST_QUESTION);

    expect(out.applied.relaxed).toEqual(['practice-area filter']);
    expect(out.results.map((r) => r.id)).toEqual(['c3', 'c2', 'c4']); // sorted by score; c1 (2) dropped — a floor of 7 would have kept it
    expect(out.results.map((r) => r.relevance)).toEqual([9, 5, 3]); // raw scores, not lifted to 7
    expect(out.results.map(matchOf)).toEqual([
      { score: 9, label: 'strong', tier: 'best' },
      { score: 5, label: 'possible', tier: 'related' },
      { score: 3, label: 'possible', tier: 'related' },
    ]);
    expect(out.answer).toBe(`${NOTE} Judge answer.`);
    expect(judgeSystems[0]).not.toContain(GIVE_EVERY_10); // the judge is really asked to score
    // nothing new was embedded and the plan was not touched
    expect(topics.embed).not.toHaveBeenCalled();
    expect(out.plan.semantic_query).toBeNull();
    expect(repo.hybrid).toHaveBeenCalledTimes(2);
    expect((repo.hybrid.mock.calls[0][0] as { serviceIds: string[] | null }).serviceIds).toEqual(['svc-gst']);
    expect((repo.hybrid.mock.calls[1][0] as { serviceIds: string[] | null }).serviceIds).toBeNull();
  });

  it('b) practice area NOT relaxed + no topic (pure filter question): unscored, unsorted, no badge — as today', async () => {
    const { service, repo, judgeSystems } = buildScoring({ plan: plan(), scores: [3, 10, 1], relaxPracticeArea: false });
    const out = await service.runSearch('five members from the UK in GST');

    expect(out.applied.relaxed).toEqual([]);
    expect(out.applied.serviceIds).toEqual(['svc-gst']); // filter still held
    expect(out.results.map((r) => r.id)).toEqual(['c1', 'c2', 'c3']); // database order, nothing dropped or sorted
    for (const r of out.results) {
      expect(r.match).toBeUndefined();
      expect(r.relevance).toBeUndefined();
    }
    expect(out.answer).toBe('Judge answer.'); // no "No one matched" note
    expect(judgeSystems[0]).toContain(GIVE_EVERY_10); // unscored prompt, as before
    expect(repo.hybrid).toHaveBeenCalledTimes(1);
  });

  it('c) topic present, nothing relaxed: unchanged (scored, sorted, no note)', async () => {
    const { service, topics, judgeSystems } = buildScoring({
      plan: plan({ semantic_query: 'transfer pricing', countries: [], service_terms: [] }),
      scores: [1, 9],
      relaxPracticeArea: false,
    });
    const out = await service.runSearch('transfer pricing experts');
    expect(out.results.map((r) => r.id)).toEqual(['c2']);
    expect(out.results[0].match).toEqual({ score: 9, label: 'strong', tier: 'best' });
    expect(out.answer).toBe('Judge answer.');
    expect(judgeSystems[0]).not.toContain(GIVE_EVERY_10);
    expect(topics.embed).toHaveBeenCalledTimes(1);
  });

  it('d) relaxed and every score under 3: no results and the "could not find a strong match" answer, no note', async () => {
    const { service } = buildScoring({ plan: plan(), scores: [1, 2, 0], relaxPracticeArea: true });
    const out = await service.runSearch(UK_GST_QUESTION);
    expect(out.results).toEqual([]);
    expect(out.answer).toBe('I could not find a strong match for that in the directory.');
  });

  it('e) UK + GST: members whose cards have no GST service cannot be labelled strong or good', async () => {
    const { service } = buildScoring({ plan: plan(), scores: [5, 4, 2], relaxPracticeArea: true });
    const out = await service.runSearch(UK_GST_QUESTION);
    expect(out.results.map((r) => r.match?.label)).toEqual(['possible', 'possible']);
    expect(out.results.every((r) => r.match?.tier === 'related')).toBe(true);
    expect(out.results.map((r) => r.relevance)).toEqual([5, 4]); // not lifted to 7
  });

  it('while the practice-area filter still holds, the floor of 7 applies (label still from the raw score)', async () => {
    const { service } = buildScoring({
      plan: plan({ semantic_query: 'gst advisory', countries: ['United Kingdom'] }),
      scores: [2],
      relaxPracticeArea: false,
    });
    const out = await service.runSearch('gst advisory in the UK');
    expect(out.applied.relaxed).toEqual([]);
    expect(out.results).toHaveLength(1);
    expect(out.results[0].relevance).toBe(7); // floor keeps a declared specialist
    expect(out.results[0].match).toEqual({ score: 2, label: 'possible', tier: 'related' }); // label from raw
  });

  it('the degraded judge path also states honestly that the practice-area requirement was dropped', async () => {
    // the judge fails after planning
    const failing = new SearchService(
      {
        matchServices: vi.fn().mockResolvedValue([{ service_id: 'svc-gst', score: 0.9 }]),
        hybrid: vi.fn(async (a: { serviceIds: string[] | null }) => (a.serviceIds ? [] : [{ doc_type: 'member', source_id: 'c1', title: 'Member 1', score: 0.03, vec_sim: null }])),
        hydrate: vi.fn().mockResolvedValue([{ type: 'member', id: 'c1', name: 'Member 1', slug: 'c1', headline: null, firm: null, location: '', services: [], available: true, rate: null }]),
        cardContents: vi.fn().mockResolvedValue(new Map()),
      } as unknown as SearchRepository,
      { chatJson: vi.fn(async (system: string) => { if (isPlanner(system)) return plan(); throw new Error('timeout'); }) } as unknown as OpenAiClient,
      { embed: vi.fn() } as unknown as TopicEmbeddingService
    );
    const out = await failing.runSearch(UK_GST_QUESTION);
    expect(out.degraded).toEqual(['judge']);
    expect(out.answer).toBe(`${NOTE} Showing 1 result(s) that best match your question.`);
  });
});

describe('SearchService date range', () => {
  it('makes a date-only upper bound inclusive (end of that day), so a single-day range finds events later that day', async () => {
    const { service, repo } = build(async (system) => {
      if (isPlanner(system)) {
        return { ...PLAN, doc_types: ['event'], semantic_query: null, date_from: '2028-02-29', date_to: '2028-02-29' };
      }
      return { scores: [{ n: 1, score: 10 }, { n: 2, score: 10 }], answer: 'ok' };
    });
    const out = await service.runSearch('events on 29 February 2028');
    const args = repo.hybrid.mock.calls[0][0] as { dateFrom: string | null; dateTo: string | null };
    expect(args.dateFrom).toBe('2028-02-29');
    expect(args.dateTo).toBe('2028-02-29T23:59:59.999Z');
    expect(out.applied.dateTo).toBe('2028-02-29'); // what the user sees is unchanged
  });

  it('leaves a missing or full-timestamp upper bound alone', async () => {
    const { service, repo } = build(async (system) =>
      isPlanner(system) ? { ...PLAN, date_to: null } : { scores: [], answer: 'ok' }
    );
    await service.runSearch('transfer pricing');
    expect((repo.hybrid.mock.calls[0][0] as { dateTo: string | null }).dateTo).toBeNull();
  });
});
