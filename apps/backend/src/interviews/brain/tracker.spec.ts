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
    const first = tracker.track('i1', [{ role: 'user', content: 'a long enough answer about the work' }]);
    void tracker.track('i1', [{ role: 'user', content: 'second' }]);
    void tracker.track('i1', [{ role: 'user', content: 'third' }]);
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
    await tracker.track('i1', [{ role: 'user', content: 'an answer with enough words in it' }]);
    expect(repo.findById).toHaveBeenCalledTimes(2);
    expect(repo.updateStateIfVersion).toHaveBeenCalledTimes(2);
  });
  it('never throws', async () => {
    const { tracker, llm, release } = setup();
    (llm.object as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    release();
    await expect(tracker.track('i1', [{ role: 'user', content: 'x y z a b c' }])).resolves.toBeUndefined();
  });
});
