// brain/analyst.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { Analyst, applyAnalystUpdate, openHighValue } from './analyst';
import { emptyState, type AnalystUpdate, type InterviewPlan } from './types';
import type { InterviewLlmService } from '../interview-llm.service';
import type { InterviewsRepository } from '../interviews.repository';

const obj = (id: string, priority: 1 | 2 | 3) => ({
  id,
  kind: 'signature_engagement' as const,
  priority,
  rationale: '',
  seedQuestions: ['q'],
  facts: ['outcome', 'metric'],
  budgetSeconds: 300,
});
const PLAN: InterviewPlan = {
  schemaVersion: 1,
  opening: 'Hi',
  objectives: [obj('e1', 1), obj('e2', 2), obj('ideal', 3)],
  knownFacts: [],
  confirmFacts: [],
  sensitivities: [],
};
const update = (o: Partial<AnalystUpdate> = {}): AnalystUpdate => ({
  filledFacts: [],
  currentObjectiveDone: false,
  nextObjectiveId: null,
  planChanges: [],
  modes: {},
  engagement: 'normal',
  extensionAnswer: null,
  confirmationAsked: false,
  guidance: '',
  ...o,
});

describe('applyAnalystUpdate', () => {
  it('fills facts and moves to the next objective when the current one is done', () => {
    const state = { ...emptyState(), currentObjectiveId: 'e1' };
    const r = applyAnalystUpdate(
      PLAN,
      state,
      update({
        filledFacts: [{ objectiveId: 'e1', fact: 'metric', value: '$2M avoided' }],
        currentObjectiveDone: true,
        nextObjectiveId: 'e2',
      })
    );
    expect(r.state.facts.e1.metric).toBe('$2M avoided');
    expect(r.state.doneObjectiveIds).toEqual(['e1']);
    expect(r.state.currentObjectiveId).toBe('e2');
  });
  it('falls back to the highest-priority open objective when next is unknown', () => {
    const state = { ...emptyState(), currentObjectiveId: 'e1' };
    const r = applyAnalystUpdate(PLAN, state, update({ currentObjectiveDone: true, nextObjectiveId: 'nope' }));
    expect(r.state.currentObjectiveId).toBe('e2');
  });
  it('adds, reprioritises and drops objectives', () => {
    const r = applyAnalystUpdate(
      PLAN,
      { ...emptyState(), currentObjectiveId: 'e1' },
      update({
        planChanges: [
          { op: 'add', objective: obj('esg', 1) },
          { op: 'reprioritise', objectiveId: 'ideal', priority: 1 },
          { op: 'drop', objectiveId: 'e2' },
        ],
      })
    );
    expect(r.plan.objectives.map((o) => o.id)).toEqual(['e1', 'ideal', 'esg']);
    expect(r.plan.objectives.find((o) => o.id === 'ideal')?.priority).toBe(1);
  });
  it('never drops the objective in progress', () => {
    const r = applyAnalystUpdate(
      PLAN,
      { ...emptyState(), currentObjectiveId: 'e1' },
      update({ planChanges: [{ op: 'drop', objectiveId: 'e1' }] })
    );
    expect(r.plan.objectives.some((o) => o.id === 'e1')).toBe(true);
  });
  it('keeps modes sticky, records the extension answer and counts confirmations', () => {
    const state = {
      ...emptyState(),
      modes: { anonymiseClients: true, memberShortOnTime: false },
      extension: { offeredAt: 'x', accepted: null },
    };
    const r = applyAnalystUpdate(
      PLAN,
      state,
      update({
        modes: { anonymiseClients: false },
        extensionAnswer: 'yes',
        confirmationAsked: true,
        engagement: 'high',
      })
    );
    expect(r.state.modes.anonymiseClients).toBe(true);
    expect(r.state.extension.accepted).toBe(true);
    expect(r.state.confirmedFacts).toBe(1);
    expect(r.state.engagement).toBe('high');
  });
});

describe('openHighValue', () => {
  it('is false once every priority-1/2 objective is done', () => {
    expect(openHighValue(PLAN, { ...emptyState(), doneObjectiveIds: ['e1', 'e2'] })).toBe(false);
    expect(openHighValue(PLAN, { ...emptyState(), doneObjectiveIds: ['e1'] })).toBe(true);
  });
});

describe('Analyst.analyse', () => {
  it('runs one analysis at a time per interview and never throws', async () => {
    let release: () => void = () => undefined;
    const object = vi.fn().mockImplementation(
      () =>
        new Promise((r) => {
          release = () => r(update());
        })
    );
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'i1', plan: PLAN, state: emptyState(), stateVersion: 0 }),
      updateStateIfVersion: vi.fn().mockResolvedValue(true),
      updateInterview: vi.fn(),
    } as unknown as InterviewsRepository;
    const analyst = new Analyst({ object } as unknown as InterviewLlmService, repo);
    const first = analyst.analyse('i1', [{ role: 'user', content: 'hello' }]);
    await analyst.analyse('i1', [{ role: 'user', content: 'again' }]); // skipped while the first runs
    release();
    await first;
    expect(object).toHaveBeenCalledTimes(1);
    object.mockRejectedValueOnce(new Error('boom'));
    await expect(analyst.analyse('i1', [{ role: 'user', content: 'x' }])).resolves.toBeUndefined();
  });
});
