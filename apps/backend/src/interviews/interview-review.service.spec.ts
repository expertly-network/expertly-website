import { describe, expect, it, vi } from 'vitest';
import { InterviewReviewService } from './interview-review.service';
import type { InterviewResultsRepository } from './interview-results.repository';
import type { InterviewsRepository } from './interviews.repository';
import type { InterviewScoringService } from './interview-scoring.service';
import type { InterviewsService } from './interviews.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';

const ADMIN = { id: 'admin1', role: 'admin' } as AuthenticatedUser;

const SCORED_CLAIM = {
  claimId: 'c1',
  claimText: 'Led APAs; call 98765 43210',
  serviceIds: ['s-ma', 's-tp'],
  probed: true,
  role: null,
  evidence: 'E2',
  facets: { recencyYear: 2024 },
  creditServiceIds: ['s-tp'],
  evidenceSummary: '',
};

function setup(o: { role?: string; status?: string; ledger?: object | null } = {}) {
  const repo = {
    findProfileRole: vi.fn().mockResolvedValue({ role: o.role ?? 'admin', status: 'active' }),
    findById: vi.fn().mockResolvedValue({
      id: 'i1',
      memberId: 'm1',
      status: o.status ?? 'completed',
      plan: {},
      ledger: o.ledger === undefined ? {} : o.ledger,
    }),
    findCurrent: vi.fn().mockResolvedValue({ id: 'i1', memberId: 'm1', status: 'completed' }),
    listConnections: vi.fn().mockResolvedValue([{ transcript: [{ role: 'user', message: 'x', timeInCallSecs: 0 }] }]),
    loadMemberContext: vi.fn().mockResolvedValue({ memberId: 'm1', services: [] }),
    updateInterview: vi.fn(),
    findMemberName: vi.fn().mockResolvedValue('Asha Rao'),
  } as unknown as InterviewsRepository;
  const results = {
    resolveFlag: vi.fn().mockResolvedValue({ id: 'f1', memberId: 'm1' }),
    applyAdminDecision: vi.fn(),
    listMemberEvidence: vi.fn().mockResolvedValue([]),
    // Validation read for decideSubtags — only 's1' has interview evidence by default.
    listEvidenceServiceIds: vi.fn().mockResolvedValue(['s1']),
    deleteStaleProposals: vi.fn(),
    insertAdminEvidence: vi.fn(),
    findCurrentScoring: vi.fn().mockResolvedValue({ id: 'sc9', result: { claims: [SCORED_CLAIM] } }),
  } as unknown as InterviewResultsRepository;
  const scoring = {
    scoreAndStore: vi.fn().mockResolvedValue({ scoringId: 's2', result: {}, verified: false }),
  } as unknown as InterviewScoringService;
  const interviews = { adminGet: vi.fn().mockResolvedValue({ id: 'i1' }) } as unknown as InterviewsService;
  return { svc: new InterviewReviewService(repo, results, scoring, interviews), repo, results, scoring };
}

describe('InterviewReviewService', () => {
  it('rescore re-runs the scorer without reuse and refreshes verified', async () => {
    const { svc, scoring, repo } = setup();
    await svc.rescore('i1');
    expect(scoring.scoreAndStore).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      expect.any(Array),
      expect.any(Object)
    );
    expect(repo.updateInterview).toHaveBeenCalledWith('i1', { verifiedAt: null });
  });

  it("rescore removes the interview's still-proposed evidence from older scorings", async () => {
    const { svc, results } = setup();
    await svc.rescore('i1');
    expect(results.deleteStaleProposals).toHaveBeenCalledWith('i1', 's2');
  });

  it('rescore returns 409 INTERVIEW_NOT_V2 for a v1 interview with no ledger', async () => {
    const { svc, scoring } = setup({ ledger: null });
    await expect(svc.rescore('i1')).rejects.toMatchObject({ status: 409, response: { code: 'INTERVIEW_NOT_V2' } });
    expect(scoring.scoreAndStore).not.toHaveBeenCalled();
  });

  it('rescore refuses interviews that are not completed', async () => {
    const { svc } = setup({ status: 'processing' });
    await expect(svc.rescore('i1')).rejects.toMatchObject({ response: { code: 'INTERVIEW_NOT_COMPLETED' } });
  });

  it('resolving a flag re-checks the admin role fresh', async () => {
    const { svc, results } = setup({ role: 'member' });
    await expect(svc.resolveFlag(ADMIN, 'f1', { status: 'dismissed' })).rejects.toMatchObject({
      response: { code: 'ADMIN_REQUIRED' },
    });
    expect(results.resolveFlag).not.toHaveBeenCalled();
  });

  it('resolves a flag with the member name attached', async () => {
    const { svc } = setup();
    await expect(svc.resolveFlag(ADMIN, 'f1', { status: 'confirmed', note: 'Asked member' })).resolves.toMatchObject({
      memberName: 'Asha Rao',
    });
  });

  it('applies each sub-tag decision after the fresh role check', async () => {
    const { svc, results } = setup();
    await svc.decideSubtags(ADMIN, 'm1', { services: [{ serviceId: 's1', accept: true }] });
    expect(results.applyAdminDecision).toHaveBeenCalledWith('m1', { serviceId: 's1', accept: true });
  });

  it('decideSubtags validates every serviceId has evidence before applying any decision', async () => {
    const { svc, results } = setup();
    await expect(
      svc.decideSubtags(ADMIN, 'm1', {
        services: [
          { serviceId: 's1', accept: true },
          { serviceId: 'unknown', accept: true },
        ],
      })
    ).rejects.toMatchObject({ response: { code: 'INTERVIEW_EVIDENCE_NOT_FOUND' } });
    expect(results.applyAdminDecision).not.toHaveBeenCalled();
  });

  it('accepting a never-proposed service seeds an active evidence row from the current scoring claim', async () => {
    const { svc, results } = setup();
    await svc.decideSubtags(ADMIN, 'm1', {
      services: [
        { serviceId: 's1', accept: true },
        { serviceId: 's-tp', accept: true, addFacetValueIds: ['fv1'] },
      ],
    });
    expect(results.insertAdminEvidence).toHaveBeenCalledWith({
      memberId: 'm1',
      serviceId: 's-tp',
      interviewId: 'i1',
      scoringId: 'sc9',
      role: 0,
      evidence: 'E2',
      recencyYear: 2024,
      summary: expect.not.stringContaining('98765'),
    });
    expect(results.applyAdminDecision).toHaveBeenCalledTimes(2);
    expect(results.applyAdminDecision).toHaveBeenLastCalledWith('m1', {
      serviceId: 's-tp',
      accept: true,
      addFacetValueIds: ['fv1'],
    });
  });

  it("also matches a claim by its ledger serviceIds when it didn't credit the service", async () => {
    const { svc, results } = setup();
    await svc.decideSubtags(ADMIN, 'm1', { services: [{ serviceId: 's-ma', accept: true }] });
    expect(results.insertAdminEvidence).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 's-ma' }));
  });

  it('404s (writing nothing) when no scored claim covers the service or the item is a rejection', async () => {
    for (const item of [
      { serviceId: 's-none', accept: true },
      { serviceId: 's-tp', accept: false },
    ]) {
      const { svc, results } = setup();
      await expect(
        svc.decideSubtags(ADMIN, 'm1', { services: [{ serviceId: 's1', accept: true }, item] })
      ).rejects.toMatchObject({ response: { code: 'INTERVIEW_EVIDENCE_NOT_FOUND' } });
      expect(results.insertAdminEvidence).not.toHaveBeenCalled();
      expect(results.applyAdminDecision).not.toHaveBeenCalled();
    }
  });
});
