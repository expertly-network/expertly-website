// brain/extractor.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { computeCoverage, Extractor } from './extractor';
import { emptyState, type InterviewPlan } from './types';
import type { InterviewLlmService } from '../interview-llm.service';

const PLAN: InterviewPlan = {
  schemaVersion: 1,
  opening: 'o',
  knownFacts: [],
  confirmFacts: [],
  sensitivities: [],
  objectives: [
    {
      id: 'e1',
      kind: 'signature_engagement',
      priority: 1,
      rationale: '',
      seedQuestions: ['q'],
      facts: ['outcome', 'metric'],
      budgetSeconds: 600,
    },
    {
      id: 'n1',
      kind: 'niche_depth',
      priority: 1,
      rationale: '',
      seedQuestions: ['q'],
      facts: ['specialisation', 'methods_or_frameworks'],
      budgetSeconds: 600,
    },
    {
      id: 'i1',
      kind: 'ideal_client',
      priority: 3,
      rationale: '',
      seedQuestions: ['q'],
      facts: ['industries'],
      budgetSeconds: 60,
    },
  ],
};
const MODEL_OUT = {
  drafts: {
    headlineBio: { headline: 'Transfer pricing advisor', bio: 'Asha advises...' },
    engagements: [{ title: 'TP restructuring', organization: 'Asha & Co', clientName: 'Acme Ltd', year: 2023 }],
    keyClients: [{ name: 'Acme Ltd' }],
  },
  summary: 'Asha is a transfer pricing specialist. Email asha@example.com.',
  assessment: {
    depth: 4,
    consistency: 5,
    coverage: 0.1,
    strengths: ['Specific'],
    vagueClaims: [],
    contradictions: [],
    notes: '',
  },
};

describe('computeCoverage', () => {
  it('is the share of priority-1 facts filled', () => {
    const state = { ...emptyState(), facts: { e1: { outcome: 'x', metric: 'y' }, n1: { specialisation: 'z' } } };
    expect(computeCoverage(PLAN, state)).toBe(0.75);
  });
});

describe('Extractor.extract', () => {
  const member = { memberId: 'm1', firstName: 'Asha', services: [] } as never;
  it('overrides coverage with the computed value and redacts the summary', async () => {
    const llm = { object: vi.fn().mockResolvedValue(MODEL_OUT) } as unknown as InterviewLlmService;
    const r = await new Extractor(llm).extract({
      plan: PLAN,
      state: { ...emptyState(), facts: { e1: { outcome: 'x' } } },
      transcript: [{ role: 'user', message: 'hi', timeInCallSecs: 1 }],
      member,
    });
    expect(r.assessment.coverage).toBe(0.25);
    expect(r.summary).not.toContain('asha@example.com');
  });
  it('drops client names and key clients in anonymised mode', async () => {
    const llm = { object: vi.fn().mockResolvedValue(MODEL_OUT) } as unknown as InterviewLlmService;
    const state = { ...emptyState(), modes: { anonymiseClients: true, memberShortOnTime: false } };
    const r = await new Extractor(llm).extract({ plan: PLAN, state, transcript: [], member });
    expect(r.drafts.engagements?.[0].clientName).toBeNull();
    expect(r.drafts.keyClients).toBeUndefined();
  });
});
