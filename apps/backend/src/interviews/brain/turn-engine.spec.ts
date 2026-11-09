// brain/turn-engine.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { TurnEngine, type TurnChunk } from './turn-engine';
import { emptyState, type InterviewPlan } from './types';
import type { InterviewLlmService } from '../interview-llm.service';
import type { InterviewsRepository } from '../interviews.repository';
import type { Analyst } from './analyst';

const PLAN: InterviewPlan = {
  schemaVersion: 1,
  opening: 'Open',
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
      facts: ['outcome'],
      budgetSeconds: 600,
    },
  ],
};

async function collect(gen: AsyncGenerator<TurnChunk>): Promise<TurnChunk[]> {
  const out: TurnChunk[] = [];
  for await (const c of gen) out.push(c);
  return out;
}

function setup(
  opts: { status?: string; elapsed?: number; startedSecondsAgo?: number; state?: object; found?: boolean } = {}
) {
  const startedAt = new Date(Date.now() - (opts.startedSecondsAgo ?? 60) * 1000).toISOString();
  const repo = {
    findByTokenHash: vi.fn().mockResolvedValue(
      opts.found === false
        ? null
        : {
            connection: {
              id: 'c1',
              startedAt,
              sessionTokenExpiresAt: new Date(Date.now() + 600_000).toISOString(),
              endedAt: null,
            },
            interview: {
              id: 'i1',
              memberId: 'm1',
              status: opts.status ?? 'in_progress',
              elapsedSeconds: opts.elapsed ?? 0,
              plan: PLAN,
              state: { ...emptyState(), currentObjectiveId: 'e1', ...(opts.state ?? {}) },
              stateVersion: 3,
            },
          }
    ),
    updateStateIfVersion: vi.fn().mockResolvedValue(true),
    loadMemberContext: vi.fn().mockResolvedValue({ firstName: 'Asha', services: [] }),
  } as unknown as InterviewsRepository;
  async function* tokens() {
    yield 'Hello ';
    yield 'there.';
  }
  const llm = { stream: vi.fn().mockReturnValue(tokens()) } as unknown as InterviewLlmService;
  const analyst = { analyse: vi.fn().mockResolvedValue(undefined) } as unknown as Analyst;
  return { engine: new TurnEngine(repo, llm, analyst), repo, llm, analyst };
}

const msgs = [
  { role: 'assistant' as const, content: 'Hi, ready?' },
  { role: 'user' as const, content: 'Yes' },
];

describe('TurnEngine.run', () => {
  it('streams the turn model reply and fires the analyst without awaiting it', async () => {
    const { engine, analyst, llm } = setup();
    const out = await collect(engine.run({ sessionToken: 't', messages: msgs, canEndCall: true }));
    expect(out).toEqual([
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'there.' },
    ]);
    expect((llm.stream as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('turn');
    expect(analyst.analyse).toHaveBeenCalledWith('i1', msgs);
  });
  it('ends the call for an unknown token', async () => {
    const { engine } = setup({ found: false });
    const out = await collect(engine.run({ sessionToken: 't', messages: msgs, canEndCall: true }));
    expect(out.at(-1)).toEqual({ type: 'end_call' });
  });
  it('records the extension offer in the offer window', async () => {
    const { engine, repo } = setup({ elapsed: 21 * 60, state: { engagement: 'high' } });
    await collect(engine.run({ sessionToken: 't', messages: msgs, canEndCall: true }));
    const saved = (repo.updateStateIfVersion as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      extension: { offeredAt: string | null };
    };
    expect(saved.extension.offeredAt).not.toBeNull();
  });
  it('says goodbye and ends the call on the second wrap-up turn', async () => {
    const { engine } = setup({ elapsed: 28 * 60, state: { wrapUpTurns: 1 } });
    const out = await collect(engine.run({ sessionToken: 't', messages: msgs, canEndCall: true }));
    expect(out.at(-1)).toEqual({ type: 'end_call' });
  });
  it('does not emit end_call when ElevenLabs did not offer the tool', async () => {
    const { engine } = setup({ elapsed: 28 * 60, state: { wrapUpTurns: 1 } });
    const out = await collect(engine.run({ sessionToken: 't', messages: msgs, canEndCall: false }));
    expect(out.some((c) => c.type === 'end_call')).toBe(false);
  });
});
