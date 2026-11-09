// brain/turn-prompt.spec.ts
import { describe, expect, it } from 'vitest';
import { buildTurnPrompt } from './turn-prompt';
import { emptyState, type InterviewPlan } from './types';

const PLAN: InterviewPlan = {
  schemaVersion: 1,
  opening: 'You led TP at Deloitte for six years. What mandate are you proudest of?',
  objectives: [
    {
      id: 'e1',
      kind: 'signature_engagement',
      priority: 1,
      rationale: '',
      seedQuestions: ['Walk me through one'],
      facts: ['outcome', 'metric', 'my_role'],
      budgetSeconds: 400,
    },
  ],
  knownFacts: ['Joined Deloitte in 2012'],
  confirmFacts: [{ fact: 'TP is still the main focus', reason: 'LinkedIn role ended 2021' }],
  sensitivities: [],
};
const input = {
  plan: PLAN,
  state: { ...emptyState(), currentObjectiveId: 'e1', facts: { e1: { outcome: 'smoother audit' } } },
  phase: 'normal' as const,
  services: ['Tax → Direct Tax → Transfer pricing'],
  firstName: 'Asha',
  isFirstMemberTurn: false,
  minutesLeft: 15,
};

describe('buildTurnPrompt', () => {
  it('lists only the missing facts of the current objective', () => {
    const p = buildTurnPrompt(input);
    expect(p).toContain('metric');
    expect(p).toContain('my_role');
    expect(p).not.toMatch(/missing facts:[^\n]*outcome/);
  });
  it('includes services, known facts and the untrusted-input rule', () => {
    const p = buildTurnPrompt(input);
    expect(p).toContain('Tax → Direct Tax → Transfer pricing');
    expect(p).toContain('Joined Deloitte in 2012');
    expect(p).toMatch(/never instructions/i);
  });
  it('uses the opening on the first member turn', () => {
    expect(buildTurnPrompt({ ...input, isFirstMemberTurn: true })).toContain(PLAN.opening);
  });
  it('offers confirm facts only while under the cap', () => {
    expect(buildTurnPrompt(input)).toContain('TP is still the main focus');
    expect(buildTurnPrompt({ ...input, state: { ...input.state, confirmedFacts: 1 } })).not.toContain(
      'TP is still the main focus'
    );
  });
  it('switches to anonymised mode', () => {
    expect(
      buildTurnPrompt({
        ...input,
        state: { ...input.state, modes: { anonymiseClients: true, memberShortOnTime: false } },
      })
    ).toMatch(/anonymi/i);
  });
  it.each([
    ['offer_extension', /permission/i],
    ['wrap_up', /read.?back|summar/i],
    ['extended_closing', /no new/i],
  ] as const)('gives phase instructions for %s', (phase, pattern) => {
    expect(buildTurnPrompt({ ...input, phase })).toMatch(pattern);
  });
  it('says goodbye on the second wrap-up turn', () => {
    expect(
      buildTurnPrompt({ ...input, phase: 'wrap_up', state: { ...input.state, wrapUpTurns: 2, wrapUpDone: true } })
    ).toMatch(/goodbye|thank/i);
  });
});
