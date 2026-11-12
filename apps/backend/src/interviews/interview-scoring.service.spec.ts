import { describe, expect, it, vi } from 'vitest';
import { SIGNAL_NAMES } from '@shared/interview';
import { InterviewScoringService } from './interview-scoring.service';
import type { Scorer } from './brain/scorer';
import type { InterviewResultsRepository } from './interview-results.repository';
import type { InterviewsRepository, InterviewRow } from './interviews.repository';
import type { MemberContext } from './brain/types';

const sig = (rating: 'supports' | 'weakens' | 'not_tested') => ({
  rating,
  turn: rating === 'not_tested' ? null : 2,
  quote: rating === 'not_tested' ? null : 'q',
});
const claim = (o: object) => ({
  claimId: 'c1',
  claimText: 'TP',
  serviceIds: ['s-tp'],
  probed: true,
  role: 5,
  evidence: 'E3',
  modelEvidence: 'E3',
  signals: Object.fromEntries(SIGNAL_NAMES.map((n, i) => [n, sig(i < 5 ? 'supports' : 'not_tested')])),
  technical: [],
  lowConfidenceTerms: [],
  facets: {
    jurisdiction: ['UK', 'Narnia'],
    instrument: ['bilateral apa', 'Section 92CA'],
    work_type: [],
    forum: [],
    client_type: [],
    industry: [],
    scale: [],
    volume: [],
    recencyYear: 2025,
  },
  creditServiceIds: ['s-tp'],
  candidateSubtags: [],
  evidenceSummary: 'Led a bilateral APA.',
  ...o,
});
const RESULT = {
  rubricVersion: 'r',
  adjacentServices: [],
  searchTerms: [],
  interviewQuality: { minutes: 14, claimsProbed: 2, endedEarly: false },
  claims: [
    claim({}),
    claim({ claimId: 'c2', claimText: 'M&A', serviceIds: ['s-ma'], role: 1, evidence: 'E1', creditServiceIds: [] }),
  ],
};
const ROW = {
  id: 'i1',
  memberId: 'm1',
  plan: { schemaVersion: 2, baselineClaimId: 'c1', claimIds: ['c1', 'c2'], opening: 'O' },
  ledger: { claims: [] },
  state: { version: 2, wrapUpDone: true },
  elapsedSeconds: 840,
} as unknown as InterviewRow;
const MEMBER = { memberId: 'm1', services: [{ serviceId: 's-tp' }, { serviceId: 's-ma' }] } as unknown as MemberContext;

function setup(current: object | null = null) {
  const scorer = { score: vi.fn().mockResolvedValue({ result: RESULT, model: 'anthropic:x' }) } as unknown as Scorer;
  const results = {
    findCurrentScoring: vi.fn().mockResolvedValue(current),
    insertScoring: vi.fn().mockResolvedValue('sc1'),
    listAnchorEntries: vi.fn().mockResolvedValue([]),
    serviceNames: vi.fn().mockResolvedValue(new Map()),
    listFacetValues: vi.fn().mockResolvedValue([
      {
        id: 'fv-uk',
        facet: 'jurisdiction',
        label: 'United Kingdom',
        slug: 'united-kingdom',
        status: 'canonical',
        aliases: ['uk'],
        sourceCount: 0,
      },
      {
        id: 'fv-apa',
        facet: 'instrument',
        label: 'Advance Pricing Agreement',
        slug: 'advance-pricing-agreement',
        status: 'canonical',
        aliases: ['bilateral apa'],
        sourceCount: 0,
      },
    ]),
    upsertCandidate: vi.fn().mockResolvedValue({ id: 'fv-new', status: 'candidate' }),
    addFacetSource: vi.fn(),
    upsertProposal: vi.fn().mockResolvedValue(true),
    insertFlags: vi.fn(),
  } as unknown as InterviewResultsRepository;
  const repo = {
    loadTaxonomy: vi.fn().mockResolvedValue([]),
    addLlmUsage: vi.fn().mockResolvedValue(undefined),
  } as unknown as InterviewsRepository;
  return { svc: new InterviewScoringService(scorer, results, repo), scorer, results };
}

describe('InterviewScoringService.scoreAndStore', () => {
  it('stores the scoring, proposes canonical facets only, queues open-facet candidates and flags firm-level work', async () => {
    const { svc, results } = setup();
    const out = await svc.scoreAndStore(ROW, [], MEMBER);
    expect(out).toMatchObject({ scoringId: 'sc1', verified: true });
    expect(results.upsertProposal).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 's-tp', role: 5, evidence: 'E3', facetValueIds: ['fv-uk', 'fv-apa'] })
    );
    // "Narnia" is a closed facet → dropped; "Section 92CA" is an open facet → candidate, not attached.
    expect(results.upsertCandidate).toHaveBeenCalledWith('instrument', 'Section 92CA');
    expect(results.upsertCandidate).not.toHaveBeenCalledWith('jurisdiction', 'Narnia');
    expect(results.addFacetSource).toHaveBeenCalledWith('fv-new', 'm1');
    expect(results.insertFlags).toHaveBeenCalledWith([
      expect.objectContaining({ claimId: 'c2', reason: 'firm_level_on_selected', scoringId: 'sc1', memberId: 'm1' }),
    ]);
  });
  it('reuses the current scoring when asked (extraction retries), but still runs proposals and flags', async () => {
    const { svc, scorer, results } = setup({ id: 'sc0', result: RESULT });
    const out = await svc.scoreAndStore(ROW, [], MEMBER, { reuseCurrent: true });
    expect(out.scoringId).toBe('sc0');
    expect(scorer.score).not.toHaveBeenCalled();
    expect(results.insertScoring).not.toHaveBeenCalled();
    expect(results.upsertProposal).toHaveBeenCalledWith(expect.objectContaining({ scoringId: 'sc0' }));
    expect(results.insertFlags).toHaveBeenCalledWith([expect.objectContaining({ scoringId: 'sc0' })]);
  });
  it('gives a flagged claim no proposal (spec §7.2)', async () => {
    const { svc, scorer, results } = setup();
    const conflicted = {
      ...RESULT,
      claims: [claim({ technical: [{ kind: 'anchor_conflict', turn: 2, quote: 'q' }] })],
    };
    (scorer.score as ReturnType<typeof vi.fn>).mockResolvedValue({ result: conflicted, model: 'm' });
    await svc.scoreAndStore(ROW, [], MEMBER);
    expect(results.upsertProposal).not.toHaveBeenCalled();
    expect(results.insertFlags).toHaveBeenCalledWith([expect.objectContaining({ reason: 'anchor_conflict' })]);
  });
  it('skips unsluggable facet values and keeps going when one value fails in the DB', async () => {
    const { svc, scorer, results } = setup();
    const odd = {
      ...RESULT,
      claims: [
        claim({
          facets: { ...claim({}).facets, jurisdiction: ['UK'], instrument: ['§§', 'Form 3CEB', 'Section 92CA'] },
        }),
      ],
    };
    (scorer.score as ReturnType<typeof vi.fn>).mockResolvedValue({ result: odd, model: 'm' });
    (results.upsertCandidate as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('db boom'))
      .mockResolvedValueOnce({ id: 'fv-92', status: 'candidate', facet: 'instrument' });
    await svc.scoreAndStore(ROW, [], MEMBER);
    expect(results.upsertCandidate).not.toHaveBeenCalledWith('instrument', '§§');
    expect(results.upsertCandidate).toHaveBeenCalledWith('instrument', 'Form 3CEB');
    expect(results.upsertCandidate).toHaveBeenCalledWith('instrument', 'Section 92CA');
    expect(results.upsertProposal).toHaveBeenCalledWith(expect.objectContaining({ facetValueIds: ['fv-uk'] }));
  });
  it('throws a typed 409 INTERVIEW_NOT_V2 for a v1 row with no ledger', async () => {
    const { svc, scorer } = setup();
    await expect(svc.scoreAndStore({ ...ROW, ledger: null } as InterviewRow, [], MEMBER)).rejects.toMatchObject({
      status: 409,
      response: { code: 'INTERVIEW_NOT_V2' },
    });
    expect(scorer.score).not.toHaveBeenCalled();
  });
  it('runs the full pipeline when reuseCurrent is requested but no scoring exists yet', async () => {
    const { svc, scorer, results } = setup(null);
    const out = await svc.scoreAndStore(ROW, [], MEMBER, { reuseCurrent: true });
    expect(out.scoringId).toBe('sc1');
    expect(scorer.score).toHaveBeenCalled();
    expect(results.insertScoring).toHaveBeenCalled();
  });
});
