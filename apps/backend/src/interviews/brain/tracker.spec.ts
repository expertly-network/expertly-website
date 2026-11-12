import { describe, expect, it, vi } from 'vitest';
import { shouldTrack, Tracker } from './tracker';
import { initialState } from './ladder';
import type { InterviewPlanV2, TrackerUpdate } from './types';
import type { InterviewLlmService } from '../interview-llm.service';
import type { InterviewsRepository } from '../interviews.repository';

const PLAN: InterviewPlanV2 = { schemaVersion: 2, baselineClaimId: 'c1', claimIds: ['c1'], opening: 'O' };
const LEDGER = {
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
const CTX = { claimId: 'c1', step: 1 as const };
const UPDATE: TrackerUpdate = {
  stepCovered: true,
  vague: false,
  personalRoleShown: null,
  buildOn: 'site visit',
  endClaimEarly: false,
  facetsAnswered: [],
  memberShortOnTime: false,
  memberAskedToStop: false,
  lowConfidenceTerm: null,
};

describe('shouldTrack', () => {
  it('tracks answers of 6+ words', () =>
    expect(shouldTrack(initialState(PLAN), 'it was a captive in Pune for us')).toBe(true));
  it('skips short acknowledgements at normal steps', () =>
    expect(shouldTrack({ ...initialState(PLAN), step: 3 }, 'yeah sure')).toBe(false));
  it('tracks short answers at step 2, during the sweep and while a re-ask is pending', () => {
    expect(shouldTrack({ ...initialState(PLAN), step: 2 }, 'just me')).toBe(true);
    expect(shouldTrack({ ...initialState(PLAN), step: 'facets' }, 'startups')).toBe(true);
    expect(shouldTrack({ ...initialState(PLAN), step: 4, reaskUsed: true }, 'no idea')).toBe(true);
  });
});

function setup() {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  const llm = {
    object: vi.fn().mockImplementation(async () => {
      await gate;
      return UPDATE;
    }),
  } as unknown as InterviewLlmService;
  const repo = {
    findById: vi
      .fn()
      .mockResolvedValue({ id: 'i1', plan: PLAN, ledger: LEDGER, state: initialState(PLAN), stateVersion: 1 }),
    updateStateIfVersion: vi.fn().mockResolvedValue(true),
    elapsedSecondsFor: vi.fn().mockResolvedValue(60),
    addLlmUsage: vi.fn(),
  } as unknown as InterviewsRepository;
  return { tracker: new Tracker(llm, repo), llm, repo, release };
}

describe('Tracker', () => {
  it('coalesces answers that arrive while a run is in flight into exactly one follow-up run', async () => {
    const { tracker, llm, release } = setup();
    const first = tracker.track('i1', [{ role: 'user', content: 'a long enough answer about the work' }], CTX);
    void tracker.track('i1', [{ role: 'user', content: 'second' }], CTX);
    void tracker.track('i1', [{ role: 'user', content: 'third' }], CTX);
    release();
    await first;
    await vi.waitFor(() => expect(llm.object).toHaveBeenCalledTimes(2));
    const secondPrompt = (llm.object as ReturnType<typeof vi.fn>).mock.calls[1][1].prompt as string;
    expect(secondPrompt).toContain('third');
  });
  it('re-reads and re-applies when the state version moved', async () => {
    const { tracker, repo, release } = setup();
    (repo.updateStateIfVersion as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    release();
    await tracker.track('i1', [{ role: 'user', content: 'an answer with enough words in it' }], CTX);
    expect(repo.findById).toHaveBeenCalledTimes(2);
    expect(repo.updateStateIfVersion).toHaveBeenCalledTimes(2);
  });
  it('does not advance the ladder when the claim switched before the update landed', async () => {
    const { tracker, repo, release } = setup();
    // The turn engine moved to closing (time budget) after the answer was given at c1 step 1.
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'i1',
      plan: PLAN,
      ledger: LEDGER,
      state: { ...initialState(PLAN), currentClaimId: null, step: 'close', doneClaimIds: ['c1'] },
      stateVersion: 2,
    });
    release();
    await tracker.track('i1', [{ role: 'user', content: 'an answer with enough words in it' }], CTX);
    const saved = (repo.updateStateIfVersion as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(saved).toMatchObject({ step: 'close', currentClaimId: null, lastTrackedIndex: 1 });
  });
  it('advances the ladder when the state still matches the answer context', async () => {
    const { tracker, repo, release } = setup();
    release();
    await tracker.track('i1', [{ role: 'user', content: 'an answer with enough words in it' }], CTX);
    const saved = (repo.updateStateIfVersion as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(saved).toMatchObject({ step: 2, currentClaimId: 'c1', buildOn: 'site visit' });
  });
  it('describes the question the answer was given under in the prompt', async () => {
    const { tracker, llm, repo, release } = setup();
    (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'i1',
      plan: PLAN,
      ledger: LEDGER,
      state: { ...initialState(PLAN), currentClaimId: null, step: 'close' },
      stateVersion: 2,
    });
    release();
    await tracker.track('i1', [{ role: 'user', content: 'an answer with enough words in it' }], CTX);
    const prompt = (llm.object as ReturnType<typeof vi.fn>).mock.calls[0][1].prompt as string;
    expect(prompt).toContain('Current claim: TP');
    expect(prompt).toContain('Current step: Context');
  });
  it('never throws', async () => {
    const { tracker, llm, release } = setup();
    (llm.object as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    release();
    await expect(tracker.track('i1', [{ role: 'user', content: 'x y z a b c' }], CTX)).resolves.toBeUndefined();
  });
});
