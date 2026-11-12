import {
  emptyStateV2,
  FACET_QUESTIONS,
  type FacetQuestion,
  type InterviewPlanV2,
  type InterviewStateV2,
  type TrackerUpdate,
} from './types';

// Pure ladder rules (spec §6.2). The Tracker reports what happened; this decides where to go.
export const CLAIM_BUDGET_SECONDS = 240;

export function initialState(plan: InterviewPlanV2): InterviewStateV2 {
  return { ...emptyStateV2(), currentClaimId: plan.claimIds[0] ?? null, step: plan.claimIds.length ? 1 : 'close' };
}

export function remainingFacets(state: InterviewStateV2): FacetQuestion[] {
  const done = state.currentClaimId ? (state.facetsDone[state.currentClaimId] ?? []) : [];
  return FACET_QUESTIONS.filter((f) => !done.includes(f));
}

export function nextClaim(plan: InterviewPlanV2, state: InterviewStateV2, elapsedSeconds: number): InterviewStateV2 {
  const doneClaimIds =
    state.currentClaimId && !state.doneClaimIds.includes(state.currentClaimId)
      ? [...state.doneClaimIds, state.currentClaimId]
      : state.doneClaimIds;
  const next = plan.claimIds.find((id) => !doneClaimIds.includes(id)) ?? null;
  return {
    ...state,
    doneClaimIds,
    currentClaimId: next,
    step: next ? 1 : 'close',
    reaskUsed: false,
    buildOn: next ? '' : state.buildOn,
    claimStartedAtSeconds: elapsedSeconds,
  };
}

export function overClaimBudget(state: InterviewStateV2, elapsedSeconds: number): boolean {
  return state.step !== 'close' && elapsedSeconds - state.claimStartedAtSeconds > CLAIM_BUDGET_SECONDS;
}

/** The claim and ladder step a tracked answer was given under. */
export interface TrackContext {
  claimId: string | null;
  step: InterviewStateV2['step'];
}

/**
 * When the state moved on since the answer was given (the turn engine switched claim on time
 * budget, or closed): record only what does not depend on the current step — the tracked index,
 * stop / short-on-time, facets for the ORIGINAL claim and the low-confidence term. The ladder is
 * not advanced (the update describes a question that is no longer the current one).
 */
function applyStaleUpdate(state: InterviewStateV2, u: TrackerUpdate, ctx: TrackContext, trackedIndex: number) {
  let s: InterviewStateV2 = { ...state, lastTrackedIndex: trackedIndex, lowConfidenceTerm: u.lowConfidenceTerm };
  if (ctx.claimId && u.facetsAnswered.length) {
    const prev = s.facetsDone[ctx.claimId] ?? [];
    s = { ...s, facetsDone: { ...s.facetsDone, [ctx.claimId]: [...new Set([...prev, ...u.facetsAnswered])] } };
  }
  if (u.memberAskedToStop) return { ...s, step: 'close' as const, stopRequested: true };
  if (u.memberShortOnTime) return { ...s, step: 'close' as const };
  return s;
}

export function applyTrackerUpdate(
  plan: InterviewPlanV2,
  state: InterviewStateV2,
  u: TrackerUpdate,
  trackedIndex: number,
  elapsedSeconds: number,
  context?: TrackContext
): InterviewStateV2 {
  if (context && (context.claimId !== state.currentClaimId || context.step !== state.step))
    return applyStaleUpdate(state, u, context, trackedIndex);
  const claim = state.currentClaimId;
  let s: InterviewStateV2 = {
    ...state,
    lastTrackedIndex: trackedIndex,
    buildOn: u.buildOn,
    lowConfidenceTerm: u.lowConfidenceTerm,
  };
  if (claim && u.facetsAnswered.length) {
    const prev = s.facetsDone[claim] ?? [];
    s = { ...s, facetsDone: { ...s.facetsDone, [claim]: [...new Set([...prev, ...u.facetsAnswered])] } };
  }
  if (claim && s.step === 2 && u.personalRoleShown !== null)
    s = { ...s, personalRole: { ...s.personalRole, [claim]: u.personalRoleShown } };

  if (u.memberAskedToStop) return { ...s, step: 'close', stopRequested: true };
  if (s.step === 'close') return s;
  if (u.memberShortOnTime) return { ...s, step: 'close' };
  if (!claim) return { ...s, step: 'close' };
  if (u.endClaimEarly) return nextClaim(plan, s, elapsedSeconds);

  if (s.step === 'facets') return remainingFacets(s).length === 0 ? nextClaim(plan, s, elapsedSeconds) : s;

  const step = s.step;
  if (u.vague && !s.reaskUsed && !u.stepCovered) return { ...s, reaskUsed: true };
  if (!u.stepCovered && !s.reaskUsed) return s;

  // Covered, or vague again after the one re-ask: move on.
  if (step === 2 && s.personalRole[claim] === false) return nextClaim(plan, s, elapsedSeconds);
  if (step < 6) return { ...s, step: (step + 1) as InterviewStateV2['step'], reaskUsed: false };
  return s.personalRole[claim] === true
    ? { ...s, step: 'facets', reaskUsed: false }
    : nextClaim(plan, s, elapsedSeconds);
}
