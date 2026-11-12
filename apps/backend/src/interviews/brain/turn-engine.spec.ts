import { describe, expect, it, vi } from 'vitest';
import { bookkeep, TurnEngine, type TurnChunk } from './turn-engine';
import { initialState } from './ladder';
import type { ClaimLedger, InterviewPlanV2, InterviewStateV2 } from './types';
import type { InterviewLlmService } from '../interview-llm.service';
import type { InterviewsRepository } from '../interviews.repository';
import type { Tracker } from './tracker';

const PLAN: InterviewPlanV2 = { schemaVersion: 2, baselineClaimId: 'c1', claimIds: ['c1'], opening: 'Open' };
const LEDGER: ClaimLedger = {
  claims: [
    {
      id: 'c1',
      text: 'TP',
      serviceIds: [],
      type: 'engagement',
      periodFrom: null,
      periodTo: null,
      source: 'bio',
      flags: [],
    },
  ],
};

async function collect(gen: AsyncGenerator<TurnChunk>): Promise<TurnChunk[]> {
  const out: TurnChunk[] = [];
  for await (const c of gen) out.push(c);
  return out;
}

function setup(o: { elapsed?: number; state?: Partial<InterviewStateV2>; found?: boolean } = {}) {
  const repo = {
    findByTokenHash: vi.fn().mockResolvedValue(
      o.found === false
        ? null
        : {
            connection: {
              id: 'c1',
              startedAt: new Date(Date.now() - 10_000).toISOString(),
              sessionTokenExpiresAt: new Date(Date.now() + 600_000).toISOString(),
              endedAt: null,
            },
            interview: {
              id: 'i1',
              memberId: 'm1',
              status: 'in_progress',
              elapsedSeconds: o.elapsed ?? 0,
              plan: PLAN,
              ledger: LEDGER,
              state: { ...initialState(PLAN), ...(o.state ?? {}) },
              stateVersion: 3,
            },
          }
    ),
    updateStateIfVersion: vi.fn().mockResolvedValue(true),
    loadMemberContext: vi.fn().mockResolvedValue({ firstName: 'Asha', services: [] }),
    addLlmUsage: vi.fn().mockResolvedValue(undefined),
  } as unknown as InterviewsRepository;
  const llm = {
    stream: vi.fn().mockImplementation(async function* () {
      yield 'Hello ';
      yield 'there.';
    }),
  } as unknown as InterviewLlmService;
  const tracker = { track: vi.fn().mockResolvedValue(undefined) } as unknown as Tracker;
  return { engine: new TurnEngine(repo, llm, tracker), repo, llm, tracker };
}
const input = (messages: { role: 'user' | 'assistant'; content: string }[]) => ({
  sessionToken: 't',
  messages,
  canEndCall: true,
});

describe('bookkeep', () => {
  it('moves to close at 12 minutes and counts close turns', () => {
    const r = bookkeep(PLAN, initialState(PLAN), 'close', 730);
    expect(r.state).toMatchObject({ step: 'close', closeTurns: 1 });
    expect(r.endsNow).toBe(false);
  });
  it('ends after the two closing questions', () => {
    const r = bookkeep(PLAN, { ...initialState(PLAN), step: 'close', closeTurns: 2 }, 'close', 800);
    expect(r).toMatchObject({ endsNow: true, goodbye: true });
    expect(r.state.wrapUpDone).toBe(true);
  });
  it('ends immediately at the hard stop or when the member asked to stop', () => {
    expect(bookkeep(PLAN, initialState(PLAN), 'stop', 1020)).toMatchObject({ endsNow: true, goodbye: true });
    expect(bookkeep(PLAN, { ...initialState(PLAN), stopRequested: true }, 'normal', 60)).toMatchObject({
      endsNow: true,
    });
  });
  it('moves on from a claim over its budget', () => {
    const r = bookkeep(PLAN, { ...initialState(PLAN), step: 3 }, 'normal', 300);
    expect(r.state.step).toBe('close'); // only one claim planned
  });
  it('ends again on a repeat turn after the goodbye', () => {
    const s = { ...initialState(PLAN), step: 'close' as const, wrapUpDone: true };
    expect(bookkeep(PLAN, s, 'close', 820)).toEqual({ state: s, endsNow: true, goodbye: true });
  });
  it('returns the same object when nothing changes', () => {
    const s = initialState(PLAN);
    expect(bookkeep(PLAN, s, 'normal', 30).state).toBe(s);
  });
});

describe('TurnEngine.run', () => {
  it('says the closing line and ends when the session is unknown', async () => {
    const { engine } = setup({ found: false });
    const out = await collect(engine.run(input([{ role: 'user', content: 'hi' }])));
    expect(out.at(-1)).toEqual({ type: 'end_call' });
  });
  it('streams with the static persona plus notes, and tracks a substantive answer', async () => {
    const { engine, llm, tracker } = setup();
    const out = await collect(
      engine.run(
        input([
          { role: 'assistant', content: 'Hi' },
          { role: 'user', content: 'it was a captive in Pune for a US group' },
        ])
      )
    );
    expect(out).toEqual([
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'there.' },
    ]);
    const args = (llm.stream as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(args.system).not.toContain('Asha');
    expect(args.notes).toContain('Asha');
    expect(tracker.track).toHaveBeenCalledWith('i1', expect.any(Array), { claimId: 'c1', step: 1 });
  });
  it('tracks an answer under the claim/step it was given at, even when this turn switches claim', async () => {
    // 300s elapsed on claim c1 (started at 0) → bookkeep moves on (only one claim → close).
    const { engine, tracker, repo } = setup({ elapsed: 300, state: { step: 3 } });
    await collect(engine.run(input([{ role: 'user', content: 'it was a captive in Pune for a US group' }])));
    expect((repo.updateStateIfVersion as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ step: 'close' });
    expect(tracker.track).toHaveBeenCalledWith('i1', expect.any(Array), { claimId: 'c1', step: 3 });
  });
  it('does not track a short acknowledgement', async () => {
    const { engine, tracker } = setup({ state: { step: 3 } });
    await collect(engine.run(input([{ role: 'user', content: 'yes' }])));
    expect(tracker.track).not.toHaveBeenCalled();
  });
  it('emits end_call after the goodbye turn', async () => {
    const { engine } = setup({ elapsed: 800, state: { step: 'close', closeTurns: 2 } });
    const out = await collect(engine.run(input([{ role: 'user', content: 'tp markups' }])));
    expect(out.at(-1)).toEqual({ type: 'end_call' });
  });
  it('caches the first name per interview', async () => {
    const { engine, repo } = setup();
    await collect(engine.run(input([{ role: 'user', content: 'a' }])));
    await collect(engine.run(input([{ role: 'user', content: 'b' }])));
    expect(repo.loadMemberContext).toHaveBeenCalledTimes(1);
  });
});
