import { describe, expect, it } from 'vitest';
import { applyTrackerUpdate, initialState, overClaimBudget, remainingFacets } from './ladder';
import type { InterviewPlanV2, InterviewStateV2, TrackerUpdate } from './types';

const PLAN: InterviewPlanV2 = { schemaVersion: 2, baselineClaimId: 'c1', claimIds: ['c1', 'c2'], opening: 'O' };
const u = (o: Partial<TrackerUpdate> = {}): TrackerUpdate => ({
  stepCovered: true,
  vague: false,
  personalRoleShown: null,
  buildOn: 'the site visit',
  endClaimEarly: false,
  facetsAnswered: [],
  memberShortOnTime: false,
  memberAskedToStop: false,
  lowConfidenceTerm: null,
  ...o,
});
const at = (o: Partial<InterviewStateV2>): InterviewStateV2 => ({ ...initialState(PLAN), ...o });

describe('ladder', () => {
  it('starts on the baseline claim at step 1', () => {
    expect(initialState(PLAN)).toMatchObject({ currentClaimId: 'c1', step: 1, claimStartedAtSeconds: 0 });
  });
  it('advances a covered step and records buildOn and the tracked index', () => {
    const s = applyTrackerUpdate(PLAN, initialState(PLAN), u(), 4, 60);
    expect(s).toMatchObject({ step: 2, reaskUsed: false, buildOn: 'the site visit', lastTrackedIndex: 4 });
  });
  it('uses one re-ask on a vague answer, then moves on even if still vague', () => {
    const s1 = applyTrackerUpdate(PLAN, at({ step: 3 }), u({ stepCovered: false, vague: true }), 2, 60);
    expect(s1).toMatchObject({ step: 3, reaskUsed: true });
    const s2 = applyTrackerUpdate(PLAN, s1, u({ stepCovered: false, vague: true }), 4, 90);
    expect(s2).toMatchObject({ step: 4, reaskUsed: false });
  });
  it('stays on the step when the answer neither covers it nor is vague', () => {
    const s = applyTrackerUpdate(PLAN, at({ step: 3 }), u({ stepCovered: false }), 2, 60);
    expect(s.step).toBe(3);
  });
  it('skips the rest of the claim when step 2 shows no personal role', () => {
    const s = applyTrackerUpdate(PLAN, at({ step: 2 }), u({ personalRoleShown: false }), 2, 100);
    expect(s).toMatchObject({ currentClaimId: 'c2', step: 1, doneClaimIds: ['c1'], claimStartedAtSeconds: 100 });
    expect(s.personalRole.c1).toBe(false);
  });
  it('goes from step 6 to the facet sweep only with a personal role', () => {
    const withRole = applyTrackerUpdate(PLAN, at({ step: 6, personalRole: { c1: true } }), u(), 2, 100);
    expect(withRole.step).toBe('facets');
    const without = applyTrackerUpdate(PLAN, at({ step: 6, personalRole: { c1: null } }), u(), 2, 100);
    expect(without).toMatchObject({ currentClaimId: 'c2', step: 1 });
  });
  it('finishes the sweep when all four facets are answered, across turns', () => {
    const s1 = applyTrackerUpdate(
      PLAN,
      at({ step: 'facets' }),
      u({ facetsAnswered: ['clients', 'industries'] }),
      2,
      100
    );
    expect(s1.step).toBe('facets');
    expect(remainingFacets(s1)).toEqual(['jurisdictions', 'scale']);
    const s2 = applyTrackerUpdate(PLAN, s1, u({ facetsAnswered: ['jurisdictions', 'scale'] }), 4, 120);
    expect(s2).toMatchObject({ currentClaimId: 'c2', step: 1 });
  });
  it('closes after the last claim', () => {
    const s = applyTrackerUpdate(
      PLAN,
      at({ currentClaimId: 'c2', doneClaimIds: ['c1'] }),
      u({ endClaimEarly: true }),
      2,
      100
    );
    expect(s).toMatchObject({ step: 'close', currentClaimId: null, doneClaimIds: ['c1', 'c2'] });
  });
  it('closes when short on time and requests a goodbye when asked to stop', () => {
    expect(applyTrackerUpdate(PLAN, initialState(PLAN), u({ memberShortOnTime: true }), 2, 60).step).toBe('close');
    const stop = applyTrackerUpdate(PLAN, initialState(PLAN), u({ memberAskedToStop: true }), 2, 60);
    expect(stop).toMatchObject({ step: 'close', stopRequested: true });
  });
  it('does not move the ladder once closing', () => {
    const s = applyTrackerUpdate(PLAN, at({ step: 'close', closeTurns: 1 }), u(), 2, 800);
    expect(s).toMatchObject({ step: 'close', closeTurns: 1 });
  });
  it('flags a claim over its ~4 minute budget', () => {
    expect(overClaimBudget(at({ claimStartedAtSeconds: 0 }), 241)).toBe(true);
    expect(overClaimBudget(at({ claimStartedAtSeconds: 0 }), 200)).toBe(false);
    expect(overClaimBudget(at({ step: 'close' }), 900)).toBe(false);
  });
});
