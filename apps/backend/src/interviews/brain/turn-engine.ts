import { Injectable, Logger } from '@nestjs/common';
import type { Json } from '../../supabase/database.types';
import { InterviewLlmService, type ChatMessage } from '../interview-llm.service';
import { InterviewsRepository } from '../interviews.repository';
import { hashSessionToken } from '../session-token';
import { Analyst, openHighValue } from './analyst';
import { phaseAt, type TimePhase } from './time-keeper';
import { buildTurnPrompt } from './turn-prompt';
import { parseState, storedPlanSchema, type InterviewState } from './types';

export type TurnChunk = { type: 'text'; text: string } | { type: 'end_call' };

const MAX_TOKENS_TURN = 300;
const MAX_SECONDS = 1800;
const CLOSING_LINE = "Thank you, that's all the time we have today. Goodbye.";

function bookkeep(
  state: InterviewState,
  phase: TimePhase,
  nowIso: string
): { state: InterviewState; endsNow: boolean } {
  if (phase === 'offer_extension' && !state.extension.offeredAt)
    return { state: { ...state, extension: { ...state.extension, offeredAt: nowIso } }, endsNow: false };
  if (phase === 'wrap_up' || phase === 'stop') {
    const wrapUpTurns = state.wrapUpTurns + 1;
    const wrapUpDone = phase === 'stop' || wrapUpTurns >= 2;
    return { state: { ...state, wrapUpTurns, wrapUpDone }, endsNow: wrapUpDone && !state.wrapUpDone };
  }
  return { state, endsNow: false };
}

@Injectable()
export class TurnEngine {
  private readonly logger = new Logger(TurnEngine.name);

  constructor(
    private readonly repo: InterviewsRepository,
    private readonly llm: InterviewLlmService,
    private readonly analyst: Analyst
  ) {}

  async *run(input: {
    sessionToken: string;
    messages: ChatMessage[];
    canEndCall: boolean;
    abortSignal?: AbortSignal;
  }): AsyncGenerator<TurnChunk> {
    const found = await this.repo.findByTokenHash(hashSessionToken(input.sessionToken));
    const now = new Date();
    if (
      !found ||
      found.interview.status !== 'in_progress' ||
      found.connection.endedAt !== null ||
      Date.parse(found.connection.sessionTokenExpiresAt) < now.getTime() ||
      !found.interview.plan
    ) {
      yield { type: 'text', text: CLOSING_LINE };
      if (input.canEndCall) yield { type: 'end_call' };
      return;
    }
    const { connection, interview } = found;
    const plan = storedPlanSchema.parse(interview.plan);
    const elapsed = interview.elapsedSeconds + Math.max(0, (now.getTime() - Date.parse(connection.startedAt)) / 1000);
    let state = parseState(interview.state);
    const phase = phaseAt({
      elapsedSeconds: elapsed,
      engagement: state.engagement,
      openHighValueObjective: openHighValue(plan, state),
      extension: state.extension,
      memberShortOnTime: state.modes.memberShortOnTime,
    });
    const booked = bookkeep(state, phase, now.toISOString());
    if (booked.state !== state) {
      const saved = await this.repo.updateStateIfVersion(
        interview.id,
        booked.state as unknown as Json,
        interview.stateVersion
      );
      if (!saved)
        this.logger.debug(`State changed under turn for ${interview.id}; using the computed state for this turn.`);
      state = booked.state;
    }

    const last = input.messages.at(-1);
    if (last?.role === 'user') void this.analyst.analyse(interview.id, input.messages.slice(-6));

    const member = await this.repo.loadMemberContext(interview.memberId);
    const system = buildTurnPrompt({
      plan,
      state,
      phase,
      services: (member?.services ?? []).map((s) => `${s.serviceLine} → ${s.category} → ${s.service}`),
      firstName: member?.firstName ?? '',
      isFirstMemberTurn: input.messages.filter((m) => m.role === 'user').length === 1,
      minutesLeft: (MAX_SECONDS - elapsed) / 60,
    });
    for await (const text of this.llm.stream('turn', {
      system,
      messages: input.messages,
      maxOutputTokens: MAX_TOKENS_TURN,
      abortSignal: input.abortSignal,
    })) {
      yield { type: 'text', text };
    }
    if (booked.endsNow && input.canEndCall) yield { type: 'end_call' };
  }
}
