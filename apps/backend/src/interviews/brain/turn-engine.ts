import { Injectable, Logger } from '@nestjs/common';
import type { Json } from '../../supabase/database.types';
import { InterviewLlmService, type ChatMessage } from '../interview-llm.service';
import { InterviewsRepository } from '../interviews.repository';
import { hashSessionToken } from '../session-token';
import { nextClaim, overClaimBudget } from './ladder';
import { phaseAt, STOP_AT_SECONDS, type TimePhase } from './time-keeper';
import { shouldTrack, Tracker } from './tracker';
import { buildTurnNotes, PERSONA } from './turn-prompt';
import { ledgerSchema, parseStateV2, planV2Schema, type InterviewPlanV2, type InterviewStateV2 } from './types';

export type TurnChunk = { type: 'text'; text: string } | { type: 'end_call' };

const MAX_TOKENS_TURN = 200;
const CLOSING_LINE = "Thank you, that's all the time we have today. Goodbye.";
const NAME_CACHE_MAX = 500;

/**
 * Per-agent-turn bookkeeping (exported for the simulated-interview script). Returns the same state
 * object when nothing changed, so callers can skip the write.
 */
export function bookkeep(
  plan: InterviewPlanV2,
  state: InterviewStateV2,
  phase: TimePhase,
  elapsedSeconds: number
): { state: InterviewStateV2; endsNow: boolean; goodbye: boolean } {
  // Already said goodbye: end again (a repeated end_call is harmless; a call left open is not).
  if (state.wrapUpDone) return { state, endsNow: true, goodbye: true };
  if (phase === 'stop' || state.stopRequested)
    return { state: { ...state, step: 'close', wrapUpDone: true }, endsNow: true, goodbye: true };
  let s = state;
  if (phase === 'close' && s.step !== 'close') s = { ...s, step: 'close' };
  if (s.step !== 'close' && overClaimBudget(s, elapsedSeconds)) s = nextClaim(plan, s, elapsedSeconds);
  if (s.step === 'close') {
    if (s.closeTurns >= 2) return { state: { ...s, wrapUpDone: true }, endsNow: true, goodbye: true };
    s = { ...s, closeTurns: s.closeTurns + 1 };
  }
  return { state: s, endsNow: false, goodbye: false };
}

@Injectable()
export class TurnEngine {
  private readonly logger = new Logger(TurnEngine.name);
  private readonly names = new Map<string, string>();

  constructor(
    private readonly repo: InterviewsRepository,
    private readonly llm: InterviewLlmService,
    private readonly tracker: Tracker
  ) {}

  private async firstName(interviewId: string, memberId: string): Promise<string> {
    const cached = this.names.get(interviewId);
    if (cached !== undefined) return cached;
    const member = await this.repo.loadMemberContext(memberId);
    const name = member?.firstName ?? '';
    if (this.names.size >= NAME_CACHE_MAX) this.names.delete(this.names.keys().next().value as string);
    this.names.set(interviewId, name);
    return name;
  }

  async *run(input: {
    sessionToken: string;
    messages: ChatMessage[];
    canEndCall: boolean;
    abortSignal?: AbortSignal;
  }): AsyncGenerator<TurnChunk> {
    const found = await this.repo.findByTokenHash(hashSessionToken(input.sessionToken));
    const now = Date.now();
    if (
      !found ||
      found.interview.status !== 'in_progress' ||
      found.connection.endedAt !== null ||
      Date.parse(found.connection.sessionTokenExpiresAt) < now ||
      !found.interview.plan ||
      !found.interview.ledger
    ) {
      yield { type: 'text', text: CLOSING_LINE };
      if (input.canEndCall) yield { type: 'end_call' };
      return;
    }
    const { connection, interview } = found;
    const plan = planV2Schema.parse(interview.plan);
    const ledger = ledgerSchema.parse(interview.ledger);
    const elapsed = interview.elapsedSeconds + Math.max(0, (now - Date.parse(connection.startedAt)) / 1000);
    const current = parseStateV2(interview.state);
    const booked = bookkeep(plan, current, phaseAt({ elapsedSeconds: elapsed }), elapsed);
    if (booked.state !== current) {
      const saved = await this.repo.updateStateIfVersion(
        interview.id,
        booked.state as unknown as NonNullable<Json>,
        interview.stateVersion
      );
      if (!saved) this.logger.debug(`State changed under turn for ${interview.id}; using the computed state.`);
    }
    const state = booked.state;

    // The member's answer was given under the state before this turn's bookkeeping (which may have
    // switched claim on time budget), so that is the context the tracker applies it to.
    const last = input.messages.at(-1);
    if (last?.role === 'user' && !booked.goodbye && shouldTrack(current, last.content))
      void this.tracker.track(interview.id, input.messages, { claimId: current.currentClaimId, step: current.step });

    const notes = buildTurnNotes({
      plan,
      ledger,
      state,
      firstName: await this.firstName(interview.id, interview.memberId),
      isFirstMemberTurn: input.messages.filter((m) => m.role === 'user').length === 1,
      minutesLeft: (STOP_AT_SECONDS - 120 - elapsed) / 60,
      goodbye: booked.goodbye,
    });
    for await (const text of this.llm.stream('turn', {
      system: PERSONA,
      messages: input.messages,
      notes,
      maxOutputTokens: MAX_TOKENS_TURN,
      abortSignal: input.abortSignal,
      onUsage: (u) => void this.repo.addLlmUsage(interview.id, 'turn', u).catch(() => undefined),
    })) {
      yield { type: 'text', text };
    }
    if (booked.endsNow && input.canEndCall) yield { type: 'end_call' };
  }
}
