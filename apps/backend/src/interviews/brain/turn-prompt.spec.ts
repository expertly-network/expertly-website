import { describe, expect, it } from 'vitest';
import { buildTurnNotes, PERSONA } from './turn-prompt';
import { initialState } from './ladder';
import type { ClaimLedger, InterviewPlanV2, InterviewStateV2 } from './types';

const PLAN: InterviewPlanV2 = {
  schemaVersion: 2,
  baselineClaimId: 'c1',
  claimIds: ['c1', 'c2'],
  opening: 'Pick one TP engagement.',
};
const LEDGER: ClaimLedger = {
  claims: [
    {
      id: 'c1',
      text: 'Bilateral APAs',
      serviceIds: [],
      type: 'engagement',
      periodFrom: 2020,
      periodTo: null,
      source: 'bio',
      flags: [],
    },
    {
      id: 'c2',
      text: 'GST appeals',
      serviceIds: [],
      type: 'engagement',
      periodFrom: 2014,
      periodTo: null,
      source: 'bio',
      flags: ['regime_before_start'],
    },
  ],
};
const notes = (state: Partial<InterviewStateV2>, o: Partial<Parameters<typeof buildTurnNotes>[0]> = {}) =>
  buildTurnNotes({
    plan: PLAN,
    ledger: LEDGER,
    state: { ...initialState(PLAN), ...state },
    firstName: 'Asha',
    isFirstMemberTurn: false,
    minutesLeft: 9.6,
    goodbye: false,
    ...o,
  });

describe('PERSONA', () => {
  it('is static and carries the core speaking rules', () => {
    expect(PERSONA).toMatch(/one sentence/i);
    expect(PERSONA).toMatch(/under 25 words/i);
    expect(PERSONA).toMatch(/never introduce a technical term/i);
    expect(PERSONA).toMatch(/internal checklists/i);
    expect(PERSONA).toMatch(/interviewer_notes/);
    expect(PERSONA).not.toContain('Asha');
  });
});

describe('buildTurnNotes', () => {
  it('opens with the AI disclosure and the planned opening on the first member turn', () => {
    const n = notes({}, { isFirstMemberTurn: true });
    expect(n).toMatch(/you are an AI/i);
    expect(n).toContain('Pick one TP engagement.');
  });
  it('names the claim, the step intent, the detail to build on and the time left', () => {
    const n = notes({ step: 3, buildOn: 'the site visit' });
    expect(n).toContain('Bilateral APAs');
    expect(n).toMatch(/Mechanics/);
    expect(n).toContain('the site visit');
    expect(n).toContain('About 10 minutes remain');
  });
  it('asks for a re-ask when one is pending', () => {
    expect(notes({ step: 4, reaskUsed: true })).toMatch(/single specific instance/i);
  });
  it('adds a neutral years question for flagged claims at step 1 only', () => {
    expect(notes({ currentClaimId: 'c2', step: 1 })).toMatch(/Which years was that/);
    expect(notes({ currentClaimId: 'c2', step: 3 })).not.toMatch(/Which years was that/);
  });
  it('lists only the open facets in the sweep', () => {
    const n = notes({ step: 'facets', facetsDone: { c1: ['clients', 'industries'] } });
    expect(n).toMatch(/countries or jurisdictions/);
    expect(n).not.toMatch(/kinds of clients/);
  });
  it('asks the two closing questions, then says goodbye', () => {
    expect(notes({ step: 'close', closeTurns: 1 })).toMatch(/alongside this work/);
    expect(notes({ step: 'close', closeTurns: 2 })).toMatch(/what words should they type/);
    expect(notes({ step: 'close' }, { goodbye: true })).toMatch(/thank/i);
  });
  it('asks to repeat or type a garbled key term', () => {
    expect(notes({ step: 3, lowConfidenceTerm: 'three CB' })).toContain('three CB');
  });
});
